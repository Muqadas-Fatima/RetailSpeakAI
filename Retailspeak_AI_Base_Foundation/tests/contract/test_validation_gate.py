"""
Phase 2 (Execution Plan §4, §5) — validation-gate unit tests.

Tied to the gate's own build per §5's testing-gates table: "Pydantic-gate
rejection tests | From Phase 0 (contract stage) | Any out-of-fixture
product_id rejected at every commit." The broader adversarial suite (100%
rejection across a deliberate battery of hallucination attempts) lives in
tests/adversarial/ per Plan §5's separate row for that suite; this file
covers the gate's ordinary accept/reject unit behavior.
"""

from __future__ import annotations

import os
import sys
from datetime import datetime, timezone
from uuid import UUID, uuid4

_REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
_NLU_HALF = os.path.join(_REPO_ROOT, "nlu-half")

for path in (
    _REPO_ROOT,
    _NLU_HALF,
    os.path.join(_NLU_HALF, "rag-retrieval-service"),
    os.path.join(_NLU_HALF, "validation-gate"),
):
    if path not in sys.path:
        sys.path.insert(0, path)

from gate import MockCatalogLookup, PydanticValidationGate
from mock_catalog import DEFAULT_STORE_ID, MockCatalogStore, _FIXTURE_PRODUCTS
from shared.contracts.order import OrderIntent, OrderJSON, OrderLineItem

STORE_ID = DEFAULT_STORE_ID
BASMATI = next(p for p in _FIXTURE_PRODUCTS if p.name_en == "Basmati Rice")


def _draft_order(line_items: list[OrderLineItem]) -> OrderJSON:
    return OrderJSON(
        session_id=uuid4(),
        store_id=STORE_ID,
        customer_id=None,
        language_mix=["ur"],
        intent=OrderIntent.ADD_ITEM,
        line_items=line_items,
        payment_method=None,
        confirmed=False,
        created_at=datetime.now(timezone.utc),
    )


def _valid_line(**overrides) -> OrderLineItem:
    defaults = dict(
        line_id="l1",
        product_id=BASMATI.product_id,
        matched_name=BASMATI.name_en,
        raw_mention="chawal",
        quantity=2,
        unit=BASMATI.unit,
        unit_price=BASMATI.price,
        confidence=1.0,
    )
    defaults.update(overrides)
    return OrderLineItem(**defaults)


def _gate() -> PydanticValidationGate:
    return PydanticValidationGate(catalog=MockCatalogLookup(MockCatalogStore()))


class TestValidationGateAccepts:
    def test_valid_line_item_accepted_and_repriced_from_live_catalog(self):
        # unit_price deliberately wrong on the incoming line -- the gate
        # must never trust it (Plan §1.3), it re-reads price from catalog.
        draft = _draft_order([_valid_line(unit_price=1.0)])
        validated_order, rejected = _gate().validate(STORE_ID, draft)

        assert rejected == []
        assert validated_order is not None
        assert validated_order.line_items[0].unit_price == BASMATI.price


class TestValidationGateRejects:
    def test_rejects_product_id_not_in_catalog(self):
        draft = _draft_order([_valid_line(product_id=uuid4())])
        validated_order, rejected = _gate().validate(STORE_ID, draft)

        assert validated_order is None
        assert len(rejected) == 1
        assert rejected[0].reason == "product_id_not_found"

    def test_rejects_inactive_product(self):
        inactive = BASMATI.model_copy(update={"is_active": False})
        gate = PydanticValidationGate(catalog=MockCatalogLookup(MockCatalogStore([inactive])))
        draft = _draft_order([_valid_line()])

        validated_order, rejected = gate.validate(STORE_ID, draft)

        assert validated_order is None
        assert rejected[0].reason == "product_inactive"

    def test_rejects_unit_mismatch(self):
        draft = _draft_order([_valid_line(unit="litre")])  # Basmati Rice is sold by "kg"
        validated_order, rejected = _gate().validate(STORE_ID, draft)

        assert validated_order is None
        assert rejected[0].reason == "unit_mismatch"

    def test_one_bad_line_blocks_the_whole_order_no_partial_accept(self):
        good_line = _valid_line(line_id="l1")
        bad_line = _valid_line(line_id="l2", product_id=uuid4(), raw_mention="ghost item")
        draft = _draft_order([good_line, bad_line])

        validated_order, rejected = _gate().validate(STORE_ID, draft)

        # No partial acceptance (TDD §4.4 / this module's docstring):
        # a single rejected line rejects the whole turn, not just that line.
        assert validated_order is None
        assert len(rejected) == 1
        assert rejected[0].line_id == "l2"

    def test_rejects_line_with_no_product_id(self):
        draft = _draft_order([_valid_line(product_id=None)])
        validated_order, rejected = _gate().validate(STORE_ID, draft)

        assert validated_order is None
        assert rejected[0].reason == "product_id_not_found"
