"""
Phase 0 exit criteria (Execution Plan §4, Phase 0):
"every downstream phase can import a stable contract package and
authenticate a request before any feature logic is written."

This file is the executable check for that sentence. It intentionally
does NOT test business logic (that belongs to Phase 1/2/3 services) —
only that the shared package is importable, that its models hold the
shapes the TDD specifies, and that the auth role-gate behaves.

Run: pip install -r requirements.txt && pytest tests/contract/ -v
"""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

import pytest
from pydantic import ValidationError

from shared.contracts import (
    ConfirmedOrder,
    FulfillmentStage,
    OrderIntent,
    OrderJSON,
    OrderLineItem,
    Product,
)
from shared.auth import AuthenticatedPrincipal, AuthorizationError, Role, require_role
from shared.config import SessionState, StoreConfig, session_key


def _sample_line_item(**overrides) -> OrderLineItem:
    defaults = dict(
        line_id="l1",
        product_id=uuid4(),
        matched_name="Basmati Rice",
        raw_mention="chawal",
        quantity=2,
        unit="kg",
        unit_price=320.0,
        confidence=0.91,
    )
    defaults.update(overrides)
    return OrderLineItem(**defaults)


def _sample_order_json(**overrides) -> OrderJSON:
    defaults = dict(
        session_id=uuid4(),
        store_id=uuid4(),
        customer_id=uuid4(),
        language_mix=["ur", "en"],
        intent=OrderIntent.CONFIRM,
        line_items=[_sample_line_item()],
        payment_method="khata",
        confirmed=True,
        confirmed_at=datetime.now(timezone.utc),
        created_at=datetime.now(timezone.utc),
    )
    defaults.update(overrides)
    return OrderJSON(**defaults)


class TestSharedContractsImportable:
    def test_every_model_is_importable_from_the_package_root(self):
        # If shared/contracts/__init__.py's __all__ drifts from what a
        # module actually exports, this import itself fails — that's the
        # entire point of "shared, one copy" (Plan §1.7).
        from shared import contracts

        assert contracts.OrderJSON is OrderJSON
        assert contracts.Product is Product


class TestOrderLineItemValidation:
    def test_valid_line_item_constructs(self):
        line = _sample_line_item()
        assert line.quantity == 2

    def test_quantity_over_500_is_rejected(self):
        # TDD §3.1 field_validator: "quantity exceeds sane per-order ceiling"
        with pytest.raises(ValidationError):
            _sample_line_item(quantity=501)

    def test_quantity_must_be_positive(self):
        with pytest.raises(ValidationError):
            _sample_line_item(quantity=0)

    def test_product_id_may_be_none_before_rag_match(self):
        # TDD §3.1: "None until RAG-matched + validated"
        line = _sample_line_item(product_id=None)
        assert line.product_id is None


class TestConfirmedOrderIsTheOnlyHandoffArtifact:
    def test_confirmed_order_requires_signature_and_total(self):
        order = _sample_order_json()
        confirmed = ConfirmedOrder(
            **order.model_dump(),
            order_id=uuid4(),
            confirmation_signature="deadbeef",
            total_amount=640.0,
        )
        assert confirmed.confirmation_signature == "deadbeef"

    def test_confirmed_order_missing_signature_is_rejected(self):
        order = _sample_order_json()
        with pytest.raises(ValidationError):
            ConfirmedOrder(**order.model_dump(), order_id=uuid4(), total_amount=640.0)


class TestFulfillmentStageVocabulary:
    def test_stage_enum_matches_tdd_5_1_sequence(self):
        # Order matters for readability/debugging only; membership is what
        # the orchestrator actually depends on.
        expected = {
            "placed",
            "inventory_verified",
            "payment_confirmed",
            "picking",
            "ready",
            "supplier_reorder_pending",
            "assigned_to_rider",
            "out_for_delivery",
            "delivered",
            "cancelled",
            "failed",
        }
        assert {s.value for s in FulfillmentStage} == expected


class TestRoleGate:
    def _principal(self, role: Role) -> AuthenticatedPrincipal:
        return AuthenticatedPrincipal(subject_id="u1", role=role, store_id="s1")

    def test_owner_can_call_owner_gated_function(self):
        @require_role(Role.OWNER)
        def decide_po(principal: AuthenticatedPrincipal) -> str:
            return "ok"

        assert decide_po(self._principal(Role.OWNER)) == "ok"

    def test_non_owner_is_rejected_from_owner_gated_function(self):
        @require_role(Role.OWNER)
        def decide_po(principal: AuthenticatedPrincipal) -> str:
            return "ok"

        with pytest.raises(AuthorizationError):
            decide_po(self._principal(Role.WAREHOUSE_STAFF))

    def test_no_generic_staff_role_exists(self):
        # Plan §Phase 0: "no generic staff role, no fallback auth mechanism"
        assert {r.value for r in Role} == {"owner", "customer", "warehouse_staff", "rider"}


class TestSessionAndStoreConfigShapes:
    def test_session_key_format(self):
        assert session_key("abc123") == "session:abc123"

    def test_session_state_defaults(self):
        s = SessionState(store_id="s1")
        assert s.customer_id is None
        assert s.language_state == []

    def test_store_config_thresholds_are_overridable_not_hardcoded(self):
        # Plan §6: RAG thresholds must be per-store config, not a constant.
        default = StoreConfig(store_id="s1")
        override = StoreConfig(store_id="s2", rag_disambiguation_floor=0.65)
        assert default.rag_disambiguation_floor == 0.72
        assert override.rag_disambiguation_floor == 0.65
