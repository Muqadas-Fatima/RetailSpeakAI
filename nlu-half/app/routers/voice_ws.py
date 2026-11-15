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
import uuid

import httpx
from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect, status
from jose.exceptions import JOSEError

from app.config import get_settings
from app.core.exceptions import AsrUnavailable
from app.core.security import decode_cognito_token
from app.database import AsyncSessionLocal
from app.redis_client import SessionStore
from app.services import catalog_ngram_service
from app.services.asr_service import transcribe
from app.services.llm_input_writer import write_llm_input
router = APIRouter(tags=["voice"])
settings = get_settings()


async def _authenticate_ws(token: str) -> str:
    """Browsers can't send an Authorization header on a WebSocket, so the
    token arrives as a query param and is verified by the same Cognito
    check as the REST endpoints."""
    claims = await decode_cognito_token(token)
    return claims["sub"]


async def _match_catalog(store_uuid: uuid.UUID, text: str) -> dict:
    """Transcript text -> product names that exist in this store's catalog."""
    async with AsyncSessionLocal() as db:
        index = await catalog_ngram_service.load_index_for_store(db, store_uuid)
    return catalog_ngram_service.match_products(text, index, fuzzy=True)


@router.websocket("/v1/voice/sessions/{session_id}/stream")
async def voice_stream(websocket: WebSocket, session_id: str, token: str = Query(...), store_id: str = Query(...)):
    try:
        customer_sub = await _authenticate_ws(token)
    except (JOSEError, httpx.HTTPError):
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Invalid or expired token")
        return

    try:
        store_uuid = uuid.UUID(store_id)
    except ValueError:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="store_id must be a UUID")
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

                    if result.transcript.strip():
                        try:
                            match = await _match_catalog(store_uuid, result.transcript)
                            write_llm_input(
                                session_id=session_id,
                                store_id=store_id,
                                transcript=result.transcript,
                                language_segments=result.language_segments,
                                match=match,
                            )
                            await websocket.send_json({"type": "catalog.matches", **match})
                        except Exception as exc:
                            await websocket.send_json(
                                {"type": "error", "error": "catalog_match_failed", "detail": str(exc)}
                            )

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
