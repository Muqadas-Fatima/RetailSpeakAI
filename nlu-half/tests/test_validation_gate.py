"""
Adversarial hallucination test suite — Foundation Plan §9: "must exist
alongside the validation-gate/ build in Phase 2, since 'zero hallucinated
products' is a hard PRD requirement" (PRD §7, TDD §12).

These tests deliberately construct draft orders that reference product_ids
NOT present in the store's live catalog (simulating what would happen if
an LLM ever emitted a hallucinated ID despite the schema-enum constraint
upstream) and assert the gate rejects 100% of them.
"""
import uuid

import pytest

from app.schemas.order import DraftOrderJSON, OrderIntent, OrderLineItem
from app.services.validation_service import validate_draft_order

pytestmark = pytest.mark.asyncio


async def test_rejects_product_id_not_in_catalog(db_session, sample_store_and_products):
    store, products = sample_store_and_products
    hallucinated_id = uuid.uuid4()  # guaranteed not to exist in the fixture

    draft = DraftOrderJSON(
        session_id="sess-1",
        store_id=store.store_id,
        intent=OrderIntent.ADD_ITEM,
        channel="chat",
        lines=[
            OrderLineItem(
                product_id=hallucinated_id,
                matched_name="Fabricated Product",
                quantity=1,
                unit="kg",
                unit_price=999,
                raw_mention="something not in the catalog",
            )
        ],
    )

    result = await validate_draft_order(db_session, draft)

    assert result.valid is False
    assert result.order is None
    assert any(e.code == "product_not_in_catalog" for e in result.errors)


async def test_rejects_product_from_a_different_store(db_session, sample_store_and_products):
    store, products = sample_store_and_products
    other_store_id = uuid.uuid4()

    draft = DraftOrderJSON(
        session_id="sess-2",
        store_id=other_store_id,  # different store than the products belong to
        intent=OrderIntent.ADD_ITEM,
        channel="voice",
        lines=[
            OrderLineItem(
                product_id=products[0].product_id,
                matched_name=products[0].name_en,
                quantity=1,
                unit="kg",
                unit_price=320,
                raw_mention="chawal",
            )
        ],
    )

    result = await validate_draft_order(db_session, draft)

    assert result.valid is False
    assert any(e.code == "product_not_in_catalog" for e in result.errors)


async def test_rejects_quantity_exceeding_max_order_qty(db_session, sample_store_and_products):
    store, products = sample_store_and_products
    rice = products[0]  # max_order_qty=20

    draft = DraftOrderJSON(
        session_id="sess-3",
        store_id=store.store_id,
        intent=OrderIntent.ADD_ITEM,
        channel="chat",
        lines=[
            OrderLineItem(
                product_id=rice.product_id,
                matched_name=rice.name_en,
                quantity=999,
                unit="kg",
                unit_price=320,
                raw_mention="do sou kilo chawal",
            )
        ],
    )

    result = await validate_draft_order(db_session, draft)

    assert result.valid is False
    assert any(e.code == "quantity_exceeds_max" for e in result.errors)


async def test_accepts_valid_order_and_restamps_price_from_live_catalog(db_session, sample_store_and_products):
    store, products = sample_store_and_products
    rice = products[0]

    draft = DraftOrderJSON(
        session_id="sess-4",
        store_id=store.store_id,
        intent=OrderIntent.ADD_ITEM,
        channel="chat",
        lines=[
            OrderLineItem(
                product_id=rice.product_id,
                matched_name="stale name the LLM might have echoed",
                quantity=2,
                unit="kg",
                unit_price=1,  # deliberately wrong — gate must re-stamp from DB
                raw_mention="do kilo chawal",
            )
        ],
    )

    result = await validate_draft_order(db_session, draft)

    assert result.valid is True
    assert result.order is not None
    assert result.order.lines[0].unit_price == float(rice.price)
    assert result.order.lines[0].matched_name == rice.name_en


@pytest.mark.parametrize("hallucinated_count", [1, 5, 20])
async def test_rejects_100_percent_of_hallucinated_lines_in_mixed_order(
    db_session, sample_store_and_products, hallucinated_count
):
    """Mixed order: some real lines, some hallucinated — gate must reject
    the whole order (fail closed), not silently drop the bad lines."""
    store, products = sample_store_and_products

    lines = [
        OrderLineItem(
            product_id=products[0].product_id,
            matched_name=products[0].name_en,
            quantity=1,
            unit="kg",
            unit_price=320,
            raw_mention="chawal",
        )
    ]
    for _ in range(hallucinated_count):
        lines.append(
            OrderLineItem(
                product_id=uuid.uuid4(),
                matched_name="Fabricated",
                quantity=1,
                unit="pcs",
                unit_price=1,
                raw_mention="fabricated item",
            )
        )

    draft = DraftOrderJSON(
        session_id="sess-5",
        store_id=store.store_id,
        intent=OrderIntent.ADD_ITEM,
        channel="chat",
        lines=lines,
    )

    result = await validate_draft_order(db_session, draft)

    assert result.valid is False
    assert len([e for e in result.errors if e.code == "product_not_in_catalog"]) == hallucinated_count
