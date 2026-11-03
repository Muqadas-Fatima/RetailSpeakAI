"""
Execution Plan §4 Phase 2 / §5: "the adversarial hallucination test suite
(deliberately prompting toward out-of-catalog items, asserting 100%
rejection at the gate) — this is a hard PRD requirement, not deferrable
to Phase 5." PRD §11: "Zero hallucinated products reaching an order (100%
rejection in adversarial testing)."

This suite does not go through the mocked LLM/RAG layers (those already
structurally cannot emit an out-of-candidate-set product_id -- see
tests/pipeline/test_phase1_mocked_pipeline.py's
test_grounder_never_selects_a_product_id_outside_the_given_candidates).
Instead it adversarially constructs draft Order JSONs the way a
compromised, buggy, or adversarially-prompted LLM output *could* look --
bypassing the "constrained enum" defense entirely -- and asserts the
Pydantic gate is the backstop that still catches every one of them. This
is the point of a defense-in-depth gate: it must not depend on the
upstream layer's good behavior to be correct.

100% rejection is asserted both on individual adversarial cases and
across a parametrized battery, so a regression that only breaks e.g.
UUID-not-in-catalog (but not inactive-product or unit-substitution)
can't slip through un-caught.
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
REAL_PRODUCT = next(p for p in _FIXTURE_PRODUCTS if p.name_en == "Basmati Rice")

# A battery of fabricated / out-of-store UUIDs standing in for whatever an
# adversarially-prompted or malfunctioning LLM might try to emit if the
# candidate-enum constraint (TDD §2.5) were somehow bypassed. Fixed, not
# random, so a failing case is reproducible.
_FABRICATED_PRODUCT_IDS = [
    UUID("11111111-1111-1111-1111-111111111111"),
    UUID("00000000-0000-0000-0000-000000000000"),
    UUID("ffffffff-ffff-ffff-ffff-ffffffffffff"),
    uuid4(),
    uuid4(),
]


def _adversarial_line(product_id: UUID, **overrides) -> OrderLineItem:
    defaults = dict(
        line_id="l1",
        product_id=product_id,
        matched_name="Sunlight Soap",  # plausible-sounding, but not RAG-verified
        raw_mention="sunlight soap",
        quantity=1,
        unit="pcs",
        unit_price=150.0,
        confidence=0.99,  # an adversarial/buggy caller claiming false confidence
    )
    defaults.update(overrides)
    return OrderLineItem(**defaults)


def _draft_order(line_items: list[OrderLineItem]) -> OrderJSON:
    return OrderJSON(
        session_id=uuid4(),
        store_id=STORE_ID,
        customer_id=None,
        language_mix=["ur", "en"],
        intent=OrderIntent.ADD_ITEM,
        line_items=line_items,
        payment_method=None,
        confirmed=False,
        created_at=datetime.now(timezone.utc),
    )


def _fresh_gate() -> PydanticValidationGate:
    return PydanticValidationGate(catalog=MockCatalogLookup(MockCatalogStore()))


class TestAdversarialHallucinationRejection:
    def test_single_fabricated_product_id_rejected(self):
        draft = _draft_order([_adversarial_line(_FABRICATED_PRODUCT_IDS[0])])
        validated_order, rejected = _fresh_gate().validate(STORE_ID, draft)

        assert validated_order is None
        assert len(rejected) == 1
        assert rejected[0].reason == "product_id_not_found"

    def test_every_fabricated_product_id_in_the_battery_is_rejected(self):
        """100% rejection across the whole battery, individually -- not
        just 'most of them.'"""
        gate = _fresh_gate()
        results = []
        for fabricated_id in _FABRICATED_PRODUCT_IDS:
            draft = _draft_order([_adversarial_line(fabricated_id)])
            validated_order, rejected = gate.validate(STORE_ID, draft)
            results.append((validated_order, rejected))

        assert all(validated_order is None for validated_order, _ in results)
        assert all(len(rejected) == 1 and rejected[0].reason == "product_id_not_found" for _, rejected in results)

    def test_fabricated_line_smuggled_alongside_a_real_line_still_rejects_the_whole_order(self):
        """The classic hallucination-smuggling attempt: one legitimate
        line item (to look plausible) plus one fabricated line item. The
        gate must reject the whole order, not silently drop the bad line
        and let the real one through -- PRD §11's "never a silent wrong-
        item substitution" / "never charge for the wrong item" bar."""
        real_line = OrderLineItem(
            line_id="l1",
            product_id=REAL_PRODUCT.product_id,
            matched_name=REAL_PRODUCT.name_en,
            raw_mention="chawal",
            quantity=2,
            unit=REAL_PRODUCT.unit,
            unit_price=REAL_PRODUCT.price,
            confidence=1.0,
        )
        fabricated_line = _adversarial_line(_FABRICATED_PRODUCT_IDS[1], line_id="l2")
        draft = _draft_order([real_line, fabricated_line])

        validated_order, rejected = _fresh_gate().validate(STORE_ID, draft)

        assert validated_order is None
        assert any(r.reason == "product_id_not_found" and r.line_id == "l2" for r in rejected)

    def test_reactivated_wording_cannot_bypass_the_gate_for_a_deactivated_product(self):
        """A product that WAS real and active at RAG-retrieval time but
        was deactivated before confirmation (TDD line 589's exact
        edge case) must still be rejected, not treated as valid just
        because the product_id genuinely exists in the store's history."""
        deactivated = REAL_PRODUCT.model_copy(update={"is_active": False})
        gate = PydanticValidationGate(catalog=MockCatalogLookup(MockCatalogStore([deactivated])))
        line = OrderLineItem(
            line_id="l1",
            product_id=deactivated.product_id,
            matched_name=deactivated.name_en,
            raw_mention="chawal",
            quantity=2,
            unit=deactivated.unit,
            unit_price=deactivated.price,
            confidence=1.0,
        )
        draft = _draft_order([line])

        validated_order, rejected = gate.validate(STORE_ID, draft)

        assert validated_order is None
        assert rejected[0].reason == "product_inactive"

    def test_cross_store_product_id_rejected(self):
        """A product_id that's real and active, but belongs to a
        DIFFERENT store, must be rejected -- TDD §8.1's store_id scoping
        applies to catalog identity too, not just role checks."""
        other_store_product = REAL_PRODUCT.model_copy(
            update={"product_id": uuid4(), "store_id": uuid4()}
        )
        gate = PydanticValidationGate(catalog=MockCatalogLookup(MockCatalogStore([other_store_product])))
        line = OrderLineItem(
            line_id="l1",
            product_id=other_store_product.product_id,
            matched_name=other_store_product.name_en,
            raw_mention="chawal",
            quantity=2,
            unit=other_store_product.unit,
            unit_price=other_store_product.price,
            confidence=1.0,
        )
        draft = _draft_order([line])

        validated_order, rejected = gate.validate(STORE_ID, draft)

        assert validated_order is None
        assert rejected[0].reason == "product_id_not_found"

    def test_unit_substitution_attempt_rejected(self):
        """A fabricated line claiming a real product_id but a unit the
        product isn't actually sold in (e.g. trying to price 'kg' items
        as cheaper/pricier 'pcs') must be rejected, not silently
        re-priced under the wrong unit."""
        line = OrderLineItem(
            line_id="l1",
            product_id=REAL_PRODUCT.product_id,
            matched_name=REAL_PRODUCT.name_en,
            raw_mention="chawal",
            quantity=2,
            unit="litre",  # Basmati Rice is sold by "kg"
            unit_price=REAL_PRODUCT.price,
            confidence=1.0,
        )
        draft = _draft_order([line])

        validated_order, rejected = _fresh_gate().validate(STORE_ID, draft)

        assert validated_order is None
        assert rejected[0].reason == "unit_mismatch"
