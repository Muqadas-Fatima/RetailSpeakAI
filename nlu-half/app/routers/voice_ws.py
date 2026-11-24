"""
Voice / text session — TDD §4.1: "WS /v1/voice/sessions/{session_id}/stream".

Client -> server
  binary frame                      audio (WebM/Opus) for the current voice turn
  {"type": "end_of_turn"}           customer stopped speaking: transcribe, then run the order pipeline
  {"type": "text", "text": "..."}   typed message: skips speech-to-text, same order pipeline
  {"type": "partial_request"}       best-effort partial transcript
  {"type": "end_session"}           close

Server -> client
  transcript.final / transcript.partial     speech-to-text result (voice only)
  order.update                               result of one turn: reply, order, clarification questions
  error                                      {"error": "...", "detail": "..."}

Voice and typed turns share one session, so they build the same running order.
"""
import json
import logging
import uuid

import httpx
from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect, status
from jose.exceptions import JOSEError

from app.config import get_settings
from app.core.exceptions import AsrUnavailable
from app.core.security import decode_cognito_token
from app.redis_client import SessionStore
from app.services import turn_pipeline_service
from app.services.asr_service import transcribe

router = APIRouter(tags=["voice"])
settings = get_settings()
logger = logging.getLogger(__name__)

MAX_TEXT_CHARS = 500


async def _authenticate_ws(token: str) -> str:
    """Browsers can't send an Authorization header on a WebSocket, so the
    token arrives as a query param and is verified by the same Cognito
    check as the REST endpoints."""
    claims = await decode_cognito_token(token)
    return claims["sub"]


def _public_update(result: dict) -> dict:
    """What the client needs from a turn result (no internal file paths)."""
    return {
        "type": "order.update",
        "source": result.get("source"),
        "transcript": result.get("transcript"),
        "status": result.get("status"),
        "reply": result.get("reply"),
        "blocks_confirmation": result.get("blocks_confirmation"),
        "subtotal": result.get("subtotal"),
        "order": result.get("order"),
        "clarifications": result.get("clarifications", []),
        "not_found": result.get("not_found", []),
        "reason": result.get("reason"),
    }


async def _run_turn(websocket: WebSocket, **kwargs) -> None:
    try:
        result = await turn_pipeline_service.run_turn(**kwargs)
    except Exception:  # never let one bad turn kill the socket
        logger.exception("order pipeline failed")
        await websocket.send_json({"type": "error", "error": "order_pipeline_failed"})
        return
    await websocket.send_json(_public_update(result))


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

    try:
        customer_uuid = uuid.UUID(customer_sub)
    except ValueError:
        customer_uuid = None

    await websocket.accept()

    session_store = SessionStore()
    await session_store.init_if_absent(session_id, store_id, customer_sub)

    audio_buffer = bytearray()

    try:
        while True:
            message = await websocket.receive()

            if message.get("type") == "websocket.disconnect":
                return

            if message.get("bytes") is not None:
                audio_buffer.extend(message["bytes"])
                continue

            if message.get("text") is not None:
                try:
                    control = json.loads(message["text"])
                except json.JSONDecodeError:
                    await websocket.send_json({"type": "error", "error": "invalid_control_frame"})
                    continue
                if not isinstance(control, dict):
                    await websocket.send_json({"type": "error", "error": "invalid_control_frame"})
                    continue

                msg_type = control.get("type")

                if msg_type == "end_of_turn":
                    if not audio_buffer:
                        await websocket.send_json({"type": "error", "error": "no_audio_received"})
                        continue
                    audio = bytes(audio_buffer)
                    audio_buffer.clear()  # every turn is a fresh recording (own WebM header)
                    try:
                        result = await transcribe(audio)
                    except AsrUnavailable as exc:
                        await websocket.send_json({"type": "error", "error": "asr_unavailable", "detail": str(exc)})
                        continue
                    await websocket.send_json(result.to_dict())

                    if result.transcript.strip():
                        await _run_turn(
                            websocket,
                            store=session_store, session_id=session_id, store_id=store_uuid,
                            text=turn_pipeline_service.clean_text(result.transcript), source="voice",
                            language_segments=result.language_segments, customer_id=customer_uuid,
                        )

                elif msg_type == "text":
                    raw = control.get("text")
                    if isinstance(raw, str) and len(raw) > MAX_TEXT_CHARS:
                        await websocket.send_json({"type": "error", "error": "text_too_long"})
                        continue
                    text = turn_pipeline_service.clean_text(raw)
                    if not text:
                        await websocket.send_json({"type": "error", "error": "empty_text"})
                        continue
                    turn_id = str(control.get("turn_id") or "")[:64] or None
                    await _run_turn(
                        websocket,
                        store=session_store, session_id=session_id, store_id=store_uuid,
                        text=text, source="text", turn_id=turn_id, customer_id=customer_uuid,
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
        # Client-side reconnect handling owns recovery (TDD §2.1); only in-flight
        # audio of the current turn is lost.
        return