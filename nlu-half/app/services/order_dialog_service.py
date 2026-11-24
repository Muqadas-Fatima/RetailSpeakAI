"""
Multi-turn order dialog: keeps the running order + open clarification
questions in the session store and applies each new customer sentence.

Per turn:
  0. Turn-level commands without any product ("that's all", "final order",
     "cancel my order") confirm or clear the order deterministically.
  1. If clarifications are pending, the LLM resolves the customer's answer
     against ONLY the options that were offered. An answer must quote words
     from the customer's sentence (evidence), and a foreign or invented id is
     never accepted.
  2. Catalog matches that belong to that answer are not handled again; genuinely
     new items go through the normal bounded grounding step. Each item carries
     an action: add | remove | reduce | set_quantity.
  3. Everything is re-validated against the live catalog (names and prices are
     re-stamped from the database every turn). A failed validation rolls the
     turn back and leaves the previous order untouched.
  4. The order JSON is written to output/orders/ (and output/orders/confirmed/
     when the customer confirms).

State lives in the session record under the TDD keys: draft_order_lines,
ambiguous_items, not_found_items (+ processed_turns for idempotency).
"""
from __future__ import annotations

import re
import unicodedata
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import LlmGroundingUnavailable
from app.schemas.llm import GroundAndAssembleRequest
from app.schemas.order import DraftOrderJSON, OrderIntent, OrderLineItem
from app.services import llm_grounding_service, order_builder_service, validation_service

MAX_REMEMBERED_TURNS = 20

# --------------------------------------------------------------------------- #
# Turn-level commands (only considered when the sentence names no product)
# --------------------------------------------------------------------------- #
_CONFIRM_PHRASES = [
    "final order", "thats all", "that is all", "thats it", "nothing else", "no more", "im done", "i am done",
    "confirm order", "confirm my order", "confirm the order", "confirm it", "place order", "place my order",
    "place the order", "checkout", "check out", "order confirm", "confirm kar do", "order kar do",
    "bas", "bas itna", "itna hi", "bas yehi", "yehi sab",
    "بس", "اتنا ہی", "بس اتنا", "کنفرم", "آرڈر کر دو", "فائنل آرڈر", "آرڈر کنفرم",
]
_CANCEL_PHRASES = [
    "cancel order", "cancel my order", "cancel the order", "clear order", "clear my order", "clear the order",
    "clear cart", "clear my cart", "clear the cart", "empty cart", "empty my cart", "empty the cart",
    "clear everything", "cancel everything", "cancel all", "start over", "remove everything", "remove all",
    "delete everything", "sab hata do", "sab kuch hata do", "order cancel", "order cancel kar do",
    "سب ہٹا دو", "آرڈر منسوخ", "آرڈر کینسل", "شروع سے",
]


def _plain(text: str) -> str:
    text = unicodedata.normalize("NFKC", text or "").lower().replace("'", "").replace("’", "")
    return " ".join(re.sub(r"[^\w\s]", " ", text).split())


def detect_turn_intent(transcript: str) -> str | None:
    """'confirm' | 'cancel_all' | None. Call only when the sentence matched no product."""
    padded = f" {_plain(transcript)} "
    if any(f" {_plain(p)} " in padded for p in _CANCEL_PHRASES):
        return "cancel_all"
    if any(f" {_plain(p)} " in padded for p in _CONFIRM_PHRASES):
        return "confirm"
    return None


# --------------------------------------------------------------------------- #
# Line helpers
# --------------------------------------------------------------------------- #
def _option_ids(pending_item: dict) -> set[str]:
    return {str(o["product_id"]) for o in pending_item["options"]}


def _fmt(q: float) -> str:
    return str(int(q)) if float(q).is_integer() else str(q)


def _find(lines: list[dict], product_id: str) -> dict | None:
    return next((l for l in lines if l["product_id"] == product_id), None)


def _apply(
    lines: list[dict], action: str, product_id: str, quantity: float | None, note: str | None,
    raw_mention: str, name: str, changes: list[str], not_in_order: list[str],
) -> None:
    """Apply one resolved item to the running order."""
    line = _find(lines, product_id)
    if action == "add":
        q = float(quantity or 1.0)
        if line:
            line["quantity"] = round(float(line["quantity"]) + q, 4)
            if note and not line.get("note"):
                line["note"] = note
        else:
            lines.append({"product_id": product_id, "quantity": q, "note": note or None, "raw_mention": raw_mention})
        return
    if line is None:
        not_in_order.append(name)
        return
    if action == "remove":
        lines.remove(line)
        changes.append(f"Removed {name}.")
    elif action == "reduce":
        q = float(quantity or 1.0)
        left = float(line["quantity"]) - q
        if left <= 0:
            lines.remove(line)
            changes.append(f"Removed {name}.")
        else:
            line["quantity"] = round(left, 4)
            changes.append(f"Reduced {name} by {_fmt(q)}.")
    elif action == "set_quantity":
        q = float(quantity or 0)
        if q <= 0:
            lines.remove(line)
            changes.append(f"Removed {name}.")
        else:
            line["quantity"] = q
            changes.append(f"Set {name} to {_fmt(q)}.")


def _new_pending(amb, candidates_by_id: dict, note: str | None = None) -> dict:
    return {
        "pending_id": uuid.uuid4().hex[:8],
        "raw_mention": amb.raw_mention,
        "question": amb.question,
        "requested_quantity": amb.requested_quantity,
        "action": getattr(amb, "action", "add"),
        "note": note,
        "options": [
            {
                "product_id": str(pid),
                "name": candidates_by_id[pid].matched_name,
                "unit": candidates_by_id[pid].unit,
                "price": candidates_by_id[pid].price,
            }
            for pid in amb.option_product_ids
            if pid in candidates_by_id
        ],
    }


def _status(lines: list, pending: list, not_found: list, changes: list, not_in_order: list) -> str:
    if pending:
        return "needs_clarification"
    if lines and not not_found and not not_in_order:
        return "ready_to_confirm"
    if lines:
        return "partially_resolved"
    if changes:
        return "order_empty"
    return "nothing_found"


async def _render(
    db: AsyncSession,
    *,
    session_id: str,
    store_id: uuid.UUID,
    transcript: str,
    lines: list[dict],
    pending: list[dict],
    not_found: list[str],
    changes: list[str] | None = None,
    not_in_order: list[str] | None = None,
    language_mix: list[str],
    channel: str,
    customer_id: uuid.UUID | None,
) -> dict:
    """Validate the accumulated lines against the live catalog and build the result."""
    changes, not_in_order = changes or [], not_in_order or []
    products = await order_builder_service._load_products(
        db, store_id, {uuid.UUID(l["product_id"]) for l in lines}
    )
    draft_lines, unavailable = [], []
    for l in lines:
        p = products.get(uuid.UUID(l["product_id"]))
        if p is None:
            unavailable.append(l)
            continue
        draft_lines.append(
            OrderLineItem(
                product_id=p.product_id, matched_name=p.name_en, quantity=l["quantity"], unit=p.unit,
                unit_price=float(p.price), raw_mention=l.get("raw_mention", ""), note=l.get("note"),
            )
        )

    errors: list[dict] = []
    order_dict, subtotal = None, 0.0
    if draft_lines:
        draft = DraftOrderJSON(
            session_id=session_id, store_id=store_id, customer_id=customer_id,
            intent=OrderIntent.ADD_ITEM, lines=draft_lines, language_mix=language_mix, channel=channel,
        )
        gate = await validation_service.validate_draft_order(db, draft)
        if gate.valid and gate.order is not None:
            order_dict = gate.order.model_dump(mode="json")
            for line, obj in zip(gate.order.lines, order_dict["lines"]):
                obj["line_total"] = line.line_total
                subtotal += line.line_total
        else:
            errors = [e.model_dump(mode="json") for e in gate.errors]

    status = "validation_failed" if errors else _status(draft_lines, pending, not_found, changes, not_in_order)
    return {
        "session_id": session_id,
        "store_id": str(store_id),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "transcript": transcript,
        "status": status,
        "reason": None,
        "blocks_confirmation": status != "ready_to_confirm",
        "order": order_dict,
        "subtotal": round(subtotal, 2),
        "clarifications": pending,
        "not_found": not_found,
        "changes": changes,
        "not_in_order": not_in_order,
        "removed_unavailable": [u["raw_mention"] for u in unavailable],
        "validation_errors": errors,
    }


async def process_turn(
    db: AsyncSession,
    store,  # SessionStore (or any object with get/set/init_if_absent)
    *,
    session_id: str,
    store_id: uuid.UUID,
    transcript: str,
    items: list[dict],
    language_mix: list[str] | None = None,
    channel: str = "voice",
    customer_id: uuid.UUID | None = None,
    turn_id: str | None = None,
    write_file: bool = True,
) -> dict:
    language_mix = language_mix or []
    transcript = (transcript or "").strip()
    state: dict[str, Any] = await store.init_if_absent(
        session_id, str(store_id), str(customer_id) if customer_id else None
    )
    lines: list[dict] = [dict(l) for l in state.get("draft_order_lines", [])]
    pending: list[dict] = [dict(p) for p in state.get("ambiguous_items", [])]
    processed: list[str] = list(state.get("processed_turns", []))

    common = dict(session_id=session_id, store_id=store_id, language_mix=language_mix,
                  channel=channel, customer_id=customer_id)

    def remember(**changed) -> None:
        state.update(changed)
        if turn_id:
            state["processed_turns"] = (processed + [turn_id])[-MAX_REMEMBERED_TURNS:]

    # the same turn must never be applied twice (script re-run, WebSocket retry)
    if turn_id and turn_id in processed:
        result = await _render(db, transcript=transcript, lines=lines, pending=pending, not_found=[], **common)
        result["reason"] = "already_processed"
        return result

    # ---- 0. turn-level commands: only when the sentence names no product ----
    intent = None if items else detect_turn_intent(transcript)

    if intent == "cancel_all":
        remember(draft_order_lines=[], ambiguous_items=[], not_found_items=[])
        await store.set(session_id, state)
        result = await _render(db, transcript=transcript, lines=[], pending=[], not_found=[], **common)
        result.update(status="cleared", reason="customer_cleared_order", blocks_confirmation=True)
        if write_file:
            result["file"] = str(order_builder_service.write_order_json(result))
        return result

    if intent == "confirm":
        result = await _render(db, transcript=transcript, lines=lines, pending=pending, not_found=[], **common)
        if pending:
            result["reason"] = "confirm_blocked_by_question"
            return result                                    # nothing changes: the question is still open
        if result["status"] == "ready_to_confirm":
            result.update(status="confirmed", blocks_confirmation=False, reason="customer_confirmed")
            if write_file:
                result["file"] = str(order_builder_service.write_confirmed_order_json(result))
                order_builder_service.write_order_json(result)
            remember(draft_order_lines=[], ambiguous_items=[], not_found_items=[])   # next sentence = new order
            await store.set(session_id, state)
        elif result["status"] == "nothing_found":
            result["reason"] = "empty_order"
        return result

    new_lines = [dict(l) for l in lines]
    new_pending: list[dict] = []
    not_found: list[str] = []
    changes: list[str] = []
    not_in_order: list[str] = []
    try:
        # ---- 1. answers to earlier questions (bounded to the offered options) ----
        answered_ids: set[str] = set()
        if pending:
            resolutions = await llm_grounding_service.resolve_pending(transcript, pending)
            res_by_id = {r.pending_id: r for r in resolutions}
            for p in pending:
                r = res_by_id.get(p["pending_id"])
                if r is None or r.decision == "unrelated":
                    new_pending.append(p)
                    continue
                answered_ids |= _option_ids(p)
                if r.decision == "resolve" and r.product_id is not None:
                    chosen = next((o for o in p["options"] if str(o["product_id"]) == str(r.product_id)), None)
                    _apply(
                        new_lines, p.get("action", "add"), str(r.product_id),
                        r.quantity or p.get("requested_quantity"), p.get("note"), p["raw_mention"],
                        chosen["name"] if chosen else p["raw_mention"], changes, not_in_order,
                    )
                elif r.decision == "still_unclear":
                    p = {**p, "question": r.question or p.get("question")}
                    if r.quantity:
                        p["requested_quantity"] = r.quantity
                    new_pending.append(p)
                # 'cancel' -> dropped

        # ---- 2. genuinely new items in this sentence ----
        fresh = [
            it for it in items
            if not (answered_ids and answered_ids & {str(x) for x in it.get("product_ids", [])})
        ]
        if fresh:
            candidates, mentions = await order_builder_service.prepare_candidates(db, store_id, fresh)
            grounded = await llm_grounding_service.ground_and_assemble(
                GroundAndAssembleRequest(
                    session_id=session_id, store_id=store_id, customer_id=customer_id, channel=channel,
                    intent="add_item", mentions=mentions, candidates=candidates,
                    language_mix=language_mix, transcript=transcript,
                )
            )
            for line in grounded.draft_order.lines:
                _apply(new_lines, line.action, str(line.product_id), line.quantity, line.note,
                       line.raw_mention, line.matched_name, changes, not_in_order)
            by_id = {c.product_id: c for cands in candidates.values() for c in cands}
            for amb in grounded.ambiguous_items:
                entry = _new_pending(amb, by_id)
                # the same question asked again replaces the old one instead of duplicating it
                new_pending = [q for q in new_pending if _option_ids(q) != _option_ids(entry)]
                new_pending.append(entry)
            not_found = list(grounded.not_found_items)
    except LlmGroundingUnavailable as exc:
        result = await _render(db, transcript=transcript, lines=lines, pending=pending, not_found=[], **common)
        result.update(status="llm_unavailable", reason=str(exc), blocks_confirmation=True)
        return result  # state untouched: the customer can simply repeat

    result = await _render(db, transcript=transcript, lines=new_lines, pending=new_pending,
                           not_found=not_found, changes=changes, not_in_order=not_in_order, **common)

    if result["status"] == "validation_failed":
        # roll the turn back: keep the previous order and open questions
        result["clarifications"] = pending
        result["reason"] = "turn_rolled_back"
        return result

    remember(draft_order_lines=new_lines, ambiguous_items=new_pending, not_found_items=not_found)
    await store.set(session_id, state)

    if write_file:
        result["file"] = str(order_builder_service.write_order_json(result))
    return result