"""
One customer turn, from text to order — shared by typed text and voice.

    text -> catalog N-gram match -> llm_inputs JSON -> order dialog (bounded LLM)
         -> validated order JSON (output/orders/) -> short reply for the customer

Typed text skips speech-to-text; everything after it is identical to voice,
so both input methods build the SAME running order inside one session.
"""
from __future__ import annotations

import re
import uuid

from app.database import AsyncSessionLocal
from app.services import catalog_ngram_service, order_dialog_service
from app.services.llm_input_writer import write_llm_input

_ARABIC_RE = re.compile(r"[\u0600-\u06FF]")
_LANG_CODES = {"english": "en", "urdu": "ur"}


def clean_text(value) -> str:
    """Typed input: a string, whitespace collapsed. Empty string if unusable."""
    if not isinstance(value, str):
        return ""
    return re.sub(r"\s+", " ", value).strip()


def _segments_from_text(text: str) -> list[dict]:
    lang = "Urdu" if _ARABIC_RE.search(text) else "English"  # Roman Urdu is Latin script
    return [{"lang": lang, "start_ms": 0, "end_ms": 0}]


def _language_mix(segments: list[dict]) -> list[str]:
    return sorted({_LANG_CODES.get(str(s.get("lang", "")).lower(), str(s.get("lang", "")).lower()) for s in segments})


def _qty(value: float) -> str:
    return str(int(value)) if float(value).is_integer() else str(value)


def build_reply(result: dict) -> str:
    """A short, plain reply built ONLY from validated data (never free LLM text,
    except the clarification question the customer must answer)."""
    status = result.get("status")
    reason = result.get("reason")
    if status == "llm_unavailable":
        return "Sorry, I couldn't process that right now. Please try again."
    if status == "validation_failed":
        reasons = "; ".join(e.get("reason", "") for e in result.get("validation_errors", []) if e.get("reason"))
        return f"I couldn't change your order: {reasons}" if reasons else "I couldn't change your order."
    if status == "cleared":
        return "Okay, I've cleared your order. What would you like?"
    if reason == "empty_order":
        return "Your order is empty. What would you like to order?"

    order = result.get("order") or {}
    lines = order.get("lines", [])
    summary = ", ".join(f"{_qty(l['quantity'])} x {l['matched_name']}" for l in lines)
    total = f"Rs {result.get('subtotal', 0):,.0f}"

    if status == "confirmed":
        return f"Order confirmed: {summary}. Total: {total}. Thank you!"

    parts: list[str] = []
    if reason == "confirm_blocked_by_question":
        parts.append("Before I can confirm, I need one answer first.")
    parts.extend(result.get("changes", []))
    if lines:
        parts.append(f"Your order: {summary}. Total: {total}.")
    elif result.get("changes"):
        parts.append("Your order is now empty.")
    questions = [c["question"] for c in result.get("clarifications", []) if c.get("question")]
    if questions:
        parts.append(" ".join(questions))
    if result.get("not_in_order"):
        parts.append(", ".join(result["not_in_order"]) + " isn't in your order.")
    if result.get("not_found"):
        parts.append("I couldn't find " + ", ".join(result["not_found"]) + " in the store.")
    if not parts:
        parts.append("Sorry, I couldn't find that in the store catalog.")
    if status == "ready_to_confirm":
        parts.append("Anything else, or shall I confirm?")
    return " ".join(parts)


async def run_turn(
    *,
    store,  # SessionStore
    session_id: str,
    store_id: uuid.UUID,
    text: str,
    source: str,  # "text" | "voice"
    turn_id: str | None = None,
    language_segments: list[dict] | None = None,
    customer_id: uuid.UUID | None = None,
) -> dict:
    segments = language_segments or _segments_from_text(text)
    async with AsyncSessionLocal() as db:
        index = await catalog_ngram_service.load_index_for_store(db, store_id)
        match = catalog_ngram_service.match_products(text, index, fuzzy=True)
        write_llm_input(
            session_id=session_id, store_id=str(store_id), transcript=text,
            language_segments=segments, match=match,
        )
        result = await order_dialog_service.process_turn(
            db, store,
            session_id=session_id, store_id=store_id, transcript=text, items=match["matches"],
            language_mix=_language_mix(segments), turn_id=turn_id or uuid.uuid4().hex,
            customer_id=customer_id,
        )
    result["source"] = source
    result["reply"] = build_reply(result)
    return result