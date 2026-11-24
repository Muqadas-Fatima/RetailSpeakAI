"""
Order builder: N-gram catalog matches -> bounded LLM grounding -> validated
order JSON file.

Anti-hallucination design (every layer is independent):
  1. The ONLY products the LLM can ever see are the catalog rows the N-gram
     matcher found (re-loaded from the database here, never taken from text).
  2. The LLM tool schema makes product_id and raw_mention enums of those values.
  3. llm_grounding_service re-checks that a picked id belongs to THAT mention.
  4. validation_service re-checks every line against the live catalog
     (exists, active, quantity > 0, <= max_order_qty) and re-stamps name /
     unit / price from the database.
Anything the LLM cannot ground becomes a clarification or a not-found entry,
never an invented line. If the LLM is down the builder fails closed.
"""
from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import LlmGroundingUnavailable
from app.models.db_models import Product
from app.schemas.llm import GroundAndAssembleRequest
from app.schemas.rag import RagCandidate
from app.services import llm_grounding_service, validation_service

# nlu-half/output/orders/
ORDERS_DIR = Path(__file__).resolve().parents[2] / "output" / "orders"

MAX_CANDIDATES = 10  # per mention, keeps the LLM prompt small and bounded


async def _load_products(
    db: AsyncSession, store_id: uuid.UUID, product_ids: set[uuid.UUID]
) -> dict[uuid.UUID, Product]:
    if not product_ids:
        return {}
    rows = await db.execute(
        select(Product).where(
            Product.product_id.in_(product_ids),
            Product.store_id == store_id,
            Product.is_active.is_(True),
        )
    )
    return {p.product_id: p for p in rows.scalars()}


def _candidate_score(item: dict, n_candidates: int) -> float:
    """One candidate = confident (exact) or its fuzzy score; several = ambiguous,
    which the LLM prompt treats as 'clarify unless the sentence decides'."""
    if n_candidates == 1:
        if item.get("match_type") == "fuzzy":
            return round(min(0.97, float(item.get("score") or 0.86)), 2)
        return 0.97
    return 0.80


def _to_candidate(p: Product, score: float) -> RagCandidate:
    return RagCandidate(
        product_id=p.product_id,
        matched_name=p.name_en,
        unit=p.unit,
        price=float(p.price),
        in_stock_qty=float(p.in_stock_qty or 0),
        max_order_qty=float(p.max_order_qty) if p.max_order_qty is not None else None,
        similarity_score=score,
    )


def _unique_key(mention: str, used: set[str]) -> str:
    key, n = mention, 2
    while key in used:
        key = f"{mention} ({n})"
        n += 1
    used.add(key)
    return key


async def prepare_candidates(
    db: AsyncSession, store_id: uuid.UUID, items: list[dict]
) -> tuple[dict[str, list[RagCandidate]], list[dict]]:
    """N-gram `items` -> (candidates per mention, mentions). Every candidate is a
    live, active catalog row re-loaded from the database."""
    wanted: set[uuid.UUID] = set()
    for item in items:
        for pid in item.get("product_ids", [])[:MAX_CANDIDATES]:
            wanted.add(uuid.UUID(str(pid)))
    products = await _load_products(db, store_id, wanted)

    candidates: dict[str, list[RagCandidate]] = {}
    mentions: list[dict] = []
    used: set[str] = set()
    for item in items:
        ids = [uuid.UUID(str(p)) for p in item.get("product_ids", [])][:MAX_CANDIDATES]
        rows = [products[i] for i in ids if i in products]
        key = _unique_key(str(item.get("mention", "")), used)
        score = _candidate_score(item, len(rows))
        candidates[key] = [_to_candidate(p, score) for p in rows]
        mentions.append({"raw_mention": key, "size_hint": item.get("size_hint"), "quantity_hint": None})
    return candidates, mentions


def _empty_result(session_id, store_id, transcript, status, reason=None) -> dict:
    return {
        "session_id": session_id,
        "store_id": str(store_id),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "transcript": transcript,
        "status": status,
        "reason": reason,
        "blocks_confirmation": status != "ready_to_confirm",
        "order": None,
        "subtotal": 0.0,
        "clarifications": [],
        "not_found": [],
        "validation_errors": [],
    }


def write_order_json(result: dict) -> Path:
    ORDERS_DIR.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
    safe = "".join(c for c in str(result.get("session_id", "")) if c.isalnum() or c in "-_")[:64]
    text = json.dumps(result, ensure_ascii=False, indent=2)
    path = ORDERS_DIR / f"{stamp}_{safe}.json"
    path.write_text(text, encoding="utf-8")
    (ORDERS_DIR / "latest_order.json").write_text(text, encoding="utf-8")
    return path


def write_confirmed_order_json(result: dict) -> Path:
    """The final, customer-confirmed order: output/orders/confirmed/."""
    folder = ORDERS_DIR / "confirmed"
    folder.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
    safe = "".join(c for c in str(result.get("session_id", "")) if c.isalnum() or c in "-_")[:64]
    text = json.dumps(result, ensure_ascii=False, indent=2)
    path = folder / f"{stamp}_{safe}.json"
    path.write_text(text, encoding="utf-8")
    (folder / "latest_confirmed.json").write_text(text, encoding="utf-8")
    return path


async def build_order(
    db: AsyncSession,
    *,
    session_id: str,
    store_id: uuid.UUID,
    transcript: str,
    items: list[dict],
    language_mix: list[str] | None = None,
    channel: str = "voice",
    customer_id: uuid.UUID | None = None,
    write_file: bool = True,
) -> dict:
    """`items` is the `items` list written by catalog N-gram matching."""
    transcript = (transcript or "").strip()

    if not items:
        result = _empty_result(session_id, store_id, transcript, "nothing_found", "no_catalog_match")
        if write_file:
            result["file"] = str(write_order_json(result))
        return result

    # ---- 1. bounded candidate sets, re-loaded from the database ----
    candidates, mentions = await prepare_candidates(db, store_id, items)

    # ---- 2. bounded LLM grounding (select / clarify / not_found + quantity) ----
    request = GroundAndAssembleRequest(
        session_id=session_id,
        store_id=store_id,
        customer_id=customer_id,
        channel=channel,
        intent="add_item",
        mentions=mentions,
        candidates=candidates,
        language_mix=language_mix or [],
        transcript=transcript,
    )
    try:
        grounded = await llm_grounding_service.ground_and_assemble(request)
    except LlmGroundingUnavailable as exc:
        result = _empty_result(session_id, store_id, transcript, "llm_unavailable", str(exc))
        if write_file:
            result["file"] = str(write_order_json(result))
        return result

    # ---- 3. validation gate on the resolved lines ----
    validation_errors: list[dict] = []
    order_dict = None
    subtotal = 0.0
    lines_ok = bool(grounded.draft_order.lines)
    if lines_ok:
        gate = await validation_service.validate_draft_order(db, grounded.draft_order)
        if gate.valid and gate.order is not None:
            order_dict = gate.order.model_dump(mode="json")
            for line, obj in zip(gate.order.lines, order_dict["lines"]):
                obj["line_total"] = line.line_total
                subtotal += line.line_total
        else:
            validation_errors = [e.model_dump(mode="json") for e in gate.errors]
            lines_ok = False

    # ---- 4. clarifications with structured, bounded options ----
    by_id: dict[uuid.UUID, RagCandidate] = {
        c.product_id: c for cands in candidates.values() for c in cands
    }
    clarifications = []
    for amb in grounded.ambiguous_items:
        clarifications.append(
            {
                "raw_mention": amb.raw_mention,
                "question": amb.question,
                "requested_quantity": amb.requested_quantity,
                "options": [
                    {
                        "product_id": str(pid),
                        "name": by_id[pid].matched_name,
                        "unit": by_id[pid].unit,
                        "price": by_id[pid].price,
                    }
                    for pid in amb.option_product_ids
                    if pid in by_id
                ],
            }
        )

    if validation_errors:
        status = "validation_failed"
    elif clarifications:
        status = "needs_clarification"
    elif lines_ok and not grounded.not_found_items:
        status = "ready_to_confirm"
    elif lines_ok:
        status = "partially_resolved"
    else:
        status = "nothing_found"

    result = {
        "session_id": session_id,
        "store_id": str(store_id),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "transcript": transcript,
        "status": status,
        "reason": None,
        "blocks_confirmation": status != "ready_to_confirm",
        "order": order_dict,
        "subtotal": round(subtotal, 2),
        "clarifications": clarifications,
        "not_found": grounded.not_found_items,
        "validation_errors": validation_errors,
    }
    if write_file:
        result["file"] = str(write_order_json(result))
    return result