"""Smoke test for the LLM grounding step.
Run from nlu-half:  python -m scripts.llm_smoke_test
"""
import asyncio
import uuid

from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.models.db_models import Product
from app.schemas.llm import GroundAndAssembleRequest
from app.schemas.rag import RagCandidate
from app.services import llm_grounding_service

STORE_ID = uuid.UUID("11111111-1111-1111-1111-111111111111")


def to_candidate(p: Product, score: float) -> RagCandidate:
    return RagCandidate(
        product_id=p.product_id,
        matched_name=p.name_en,
        unit=p.unit,
        price=float(p.price),
        in_stock_qty=float(p.in_stock_qty or 0),
        max_order_qty=float(p.max_order_qty) if p.max_order_qty is not None else None,
        similarity_score=score,
    )


async def products_like(db, pattern: str, limit: int) -> list[Product]:
    rows = await db.execute(
        select(Product)
        .where(Product.store_id == STORE_ID, Product.is_active.is_(True), Product.name_en.ilike(pattern))
        .order_by(Product.name_en)
        .limit(limit)
    )
    return list(rows.scalars())


async def run_case(title: str, mentions: list[dict], candidates: dict) -> None:
    req = GroundAndAssembleRequest(
        session_id="smoke-test",
        store_id=STORE_ID,
        channel="voice",
        intent="add_item",
        mentions=mentions,
        candidates=candidates,
        language_mix=["en"],
    )
    res = await llm_grounding_service.ground_and_assemble(req)
    print(f"\n=== {title}")
    for line in res.draft_order.lines:
        print(f"  SELECTED : {line.matched_name} x {line.quantity} {line.unit} @ {line.unit_price}")
    for item in res.ambiguous_items:
        print(f"  AMBIGUOUS: '{item.raw_mention}' options = {item.options}")
    for name in res.not_found_items:
        print(f"  NOT FOUND: '{name}'")


async def main() -> None:
    async with AsyncSessionLocal() as db:
        milk = await products_like(db, "Haleeb Milk 1L%", 1)
        rice = await products_like(db, "%Basmati Rice%", 3)

    await run_case(
        "1) one clear product, quantity 2 -> expect SELECTED Haleeb Milk 1L x 2",
        [{"raw_mention": "haleeb milk", "quantity_hint": 2}],
        {"haleeb milk": [to_candidate(p, 0.97) for p in milk]},
    )
    await run_case(
        "2) 'rice' with several candidates -> expect AMBIGUOUS",
        [{"raw_mention": "rice", "quantity_hint": 2}],
        {"rice": [to_candidate(p, 0.80) for p in rice]},
    )
    await run_case(
        "3) 'pizza' with no candidates -> expect NOT FOUND",
        [{"raw_mention": "pizza", "quantity_hint": 1}],
        {"pizza": []},
    )


if __name__ == "__main__":
    asyncio.run(main())