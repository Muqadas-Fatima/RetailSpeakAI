"""
Voice Session -> ASR — TDD §4.1: "WS /v1/voice/sessions/{session_id}/stream
— binary Opus frames in, JSON transcript events out."

Protocol implemented here:
  - Client sends binary WebSocket frames of Opus-encoded audio
    (client already handles jitter buffering per §2.1 — this endpoint
    just accumulates what it's given).
  - Client sends a text control frame `{"type": "end_of_turn"}` when the
    customer stops speaking; the server transcribes the accumulated
    buffer and emits a `transcript.final` event, then clears the buffer
    for the next turn.
  - Client may send `{"type": "partial_request"}` at any point to get a
    best-effort `transcript.partial` from whatever audio has arrived so
    far (used for live-captioning UX; not authoritative).
  - On disconnect/reconnect, session audio state is NOT preserved across
    a socket drop (only the Redis *conversation* state is) — matches the
    PRD's client-side "handle reconnect on network drop" responsibility
    living in the WebRTC client, not this service (TDD §2.1).
"""
import json

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect, status
from jose import JOSEError, jwt

from app.config import get_settings
from app.core.exceptions import AsrUnavailable
from app.core.security import _get_signing_key
from app.redis_client import SessionStore
from app.services.asr_service import transcribe

router = APIRouter(tags=["voice"])
settings = get_settings()


async def _authenticate_ws(token: str) -> str:
    """WebSockets can't carry an Authorization header from browser
    clients, so the token is passed as a query param; validated with the
    same Cognito JWKS check as the REST endpoints."""
    unverified_header = jwt.get_unverified_header(token)
    kid = unverified_header.get("kid")
    signing_key = await _get_signing_key(kid) if kid else None
    if signing_key is None:
        raise JOSEError("Unable to verify token signature")
    claims = jwt.decode(
        token, signing_key, algorithms=["RS256"], audience=settings.cognito_app_client_id
    )
    return claims["sub"]


@router.websocket("/v1/voice/sessions/{session_id}/stream")
async def voice_stream(websocket: WebSocket, session_id: str, token: str = Query(...), store_id: str = Query(...)):
    try:
        customer_sub = await _authenticate_ws(token)
    except JOSEError:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Invalid or expired token")
        return

    await websocket.accept()

    session_store = SessionStore()
    await session_store.init_if_absent(session_id, store_id, customer_sub)

    audio_buffer = bytearray()

    try:
        while True:
            message = await websocket.receive()

            if message.get("bytes") is not None:
                audio_buffer.extend(message["bytes"])
                continue

            if message.get("text") is not None:
                try:
                    control = json.loads(message["text"])
                except json.JSONDecodeError:
                    await websocket.send_json({"type": "error", "error": "invalid_control_frame"})
                    continue

                msg_type = control.get("type")

                if msg_type == "end_of_turn":
                    if not audio_buffer:
                        await websocket.send_json({"type": "error", "error": "no_audio_received"})
                        continue
                    try:
                        result = await transcribe(bytes(audio_buffer))
                    except AsrUnavailable as exc:
                        await websocket.send_json({"type": "error", "error": "asr_unavailable", "detail": str(exc)})
                        continue
                    await websocket.send_json(result.to_dict())
                    audio_buffer.clear()

                elif msg_type == "partial_request":
                    if not audio_buffer:
                        continue
                    try:
                        result = await transcribe(bytes(audio_buffer))
                        result.is_final = False
                    except AsrUnavailable:
                        continue  # partial transcripts are best-effort; swallow failures
                    await websocket.send_json(result.to_dict())

                elif msg_type == "end_session":
                    break

    except WebSocketDisconnect:
        # Client-side reconnect handling owns recovery (TDD §2.1); nothing
        # to compensate here since only in-flight (unbuffered-to-Redis)
        # audio for the current turn is lost, matching FA's stated
        # session-expiry baseline for partial-turn loss.
        return
