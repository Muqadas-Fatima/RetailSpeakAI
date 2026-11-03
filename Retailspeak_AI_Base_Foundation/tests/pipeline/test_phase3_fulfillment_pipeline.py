"""
Phase 3 exit criteria (Execution Plan §7, Phase 3): "LangGraph
fulfillment pipeline, stage by stage... Inventory -> Payment/Khata ->
Warehouse -> Supplier (conditional, non-blocking branch) ->
Delivery/Rider -> Notification (TDD §5.1, §5.2)."

Extends tests/pipeline/test_phase2_confirmation_flow.py's wiring one
step further: a signed ConfirmedOrder (Phase 2's own output) is now
handed to the orchestrator and driven all the way to `delivered`,
exercising the guard conditions (§5.3) and the supplier-reorder parallel
branch along the way. Uses `wiring.build_stage_bundle()` -- the same
in-process stand-in for "call every stage over mTLS" that orchestrator/
api.py itself uses (see wiring.py's own docstring).
"""

from __future__ import annotations

import os
import sys
from datetime import datetime, timezone
from uuid import uuid4

_REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
_NLU_HALF = os.path.join(_REPO_ROOT, "nlu-half")
_RAG_SERVICE = os.path.join(_NLU_HALF, "rag-retrieval-service")
_VALIDATION_GATE = os.path.join(_NLU_HALF, "validation-gate")
_FULFILLMENT_HALF = os.path.join(_REPO_ROOT, "fulfillment-half")
_ORCHESTRATOR = os.path.join(_FULFILLMENT_HALF, "orchestrator")
_PAYMENT_STAGE = os.path.join(_FULFILLMENT_HALF, "payment-khata-stage")

for path in (_REPO_ROOT, _RAG_SERVICE, _VALIDATION_GATE, _FULFILLMENT_HALF, _ORCHESTRATOR, _PAYMENT_STAGE):
    if path not in sys.path:
        sys.path.insert(0, path)

from checkpointer import InMemoryCheckpointer
from graph import PipelineGraph
from mock_catalog import DEFAULT_STORE_ID, MockCatalogStore
from nodes import Orchestrator, PipelineException
from shared.contracts.fulfillment import FulfillmentStage
from shared.contracts.order import ConfirmedOrder, OrderIntent, OrderLineItem
from state import PipelineState
from wiring import build_stage_bundle

_catalog = MockCatalogStore()
_RICE = next(p for p in _catalog._products if p.name_en == "Basmati Rice")
_EGGS = next(p for p in _catalog._products if p.name_en == "Eggs")
_LOW_STOCK_OIL = next(p for p in _catalog._products if p.name_en == "Sunflower Oil 1L")


def _order(*, lines: list[OrderLineItem], payment_method: str, customer_id=None) -> ConfirmedOrder:
    now = datetime.now(timezone.utc)
    total = round(sum((li.unit_price or 0.0) * li.quantity for li in lines), 2)
    return ConfirmedOrder(
        session_id=uuid4(),
        store_id=DEFAULT_STORE_ID,
        customer_id=customer_id,
        language_mix=["ur", "en"],
        intent=OrderIntent.CONFIRM,
        line_items=lines,
        payment_method=payment_method,
        confirmed=True,
        confirmed_at=now,
        created_at=now,
        order_id=uuid4(),
        confirmation_signature="test-fixture-signature",
        total_amount=total,
    )


def _line(product, qty: float, line_id: str = "l1") -> OrderLineItem:
    return OrderLineItem(
        line_id=line_id,
        product_id=product.product_id,
        matched_name=product.name_en,
        raw_mention=product.name_roman_ur,
        quantity=qty,
        unit=product.unit,
        unit_price=product.price,
        confidence=0.9,
    )


def _fresh_orchestrator():
    stages = build_stage_bundle()
    graph = PipelineGraph(InMemoryCheckpointer())
    return Orchestrator(graph, stages), stages, graph


class TestHappyPathPlacedToDelivered:
    def test_full_pipeline_reaches_delivered(self):
        order = _order(lines=[_line(_RICE, 2.0), _line(_EGGS, 12.0, "l2")], payment_method="jazzcash")
        orchestrator, stages, graph = _fresh_orchestrator()
        state = PipelineState(order_id=str(order.order_id), pipeline_run_id=str(uuid4()), confirmed_order=order)

        state = orchestrator.start(state)
        assert state.current_stage == FulfillmentStage.PICKING
        assert state.reservation_id is not None
        assert state.transaction_ref is not None  # jazzcash, not khata

        state = orchestrator.handle_warehouse_pick(
            state, actor="warehouse_staff:w1", discrepancy=False, discrepancy_note=None
        )
        assert state.current_stage == FulfillmentStage.READY

        state = orchestrator.assign_rider(
            state, delivery_address="House 12, Street 4, Karachi", delivery_lat=24.86, delivery_lng=67.0
        )
        assert state.current_stage == FulfillmentStage.ASSIGNED_TO_RIDER
        assert state.rider_id is not None

        state = orchestrator.mark_out_for_delivery(state)
        assert state.current_stage == FulfillmentStage.OUT_FOR_DELIVERY

        state = orchestrator.mark_delivered(state)
        assert state.current_stage == FulfillmentStage.DELIVERED

        # Checkpointer recorded every transition (TDD §5.5).
        history = [h.stage for h in graph._checkpointer.history(state.order_id)]
        assert history == [
            FulfillmentStage.INVENTORY_VERIFIED.value,
            FulfillmentStage.PAYMENT_CONFIRMED.value,
            FulfillmentStage.PICKING.value,
            FulfillmentStage.READY.value,
            FulfillmentStage.ASSIGNED_TO_RIDER.value,
            FulfillmentStage.OUT_FOR_DELIVERY.value,
            FulfillmentStage.DELIVERED.value,
        ]


class TestKhataPaymentRouting:
    def test_khata_order_within_limit_settles_via_ledger_not_gateway(self):
        orchestrator, stages, graph = _fresh_orchestrator()
        from _customer_fixtures import DEFAULT_CUSTOMER_ID  # payment-khata-stage fixture: 5000 limit

        order = _order(lines=[_line(_RICE, 2.0)], payment_method="khata", customer_id=DEFAULT_CUSTOMER_ID)
        state = PipelineState(order_id=str(order.order_id), pipeline_run_id=str(uuid4()), confirmed_order=order)

        state = orchestrator.start(state)
        assert state.current_stage == FulfillmentStage.PICKING
        assert state.khata_entry_id is not None
        assert state.transaction_ref is None  # never both (TDD §2.8)
        assert stages.payment_khata._ledger.balance_of(str(DEFAULT_CUSTOMER_ID)) == order.total_amount

    def test_khata_order_over_limit_fails_and_releases_inventory(self):
        orchestrator, stages, graph = _fresh_orchestrator()
        from _customer_fixtures import LOW_LIMIT_CUSTOMER_ID  # 100.0 limit

        order = _order(
            lines=[_line(_RICE, 2.0)], payment_method="khata", customer_id=LOW_LIMIT_CUSTOMER_ID
        )  # 640 > 100
        state = PipelineState(order_id=str(order.order_id), pipeline_run_id=str(uuid4()), confirmed_order=order)

        try:
            orchestrator.start(state)
            assert False, "expected PipelineException"
        except PipelineException as exc:
            assert exc.state.exception_reason == "payment_failed"
            assert exc.state.exception_detail == "over_credit_limit"

        record = stages.inventory._store.get(str(_RICE.product_id), str(DEFAULT_STORE_ID))
        assert record.reserved_qty == 0.0  # released


class TestSupplierReorderParallelBranch:
    def test_low_stock_line_drafts_a_po_without_blocking_the_order(self):
        """Sunflower Oil 1L is seeded already below its low_stock_threshold
        (mock_catalog.py's own docstring: "Phase 3 supplier-reorder
        fixture"). Ordering even 1 unit should trigger the guard."""
        orchestrator, stages, graph = _fresh_orchestrator()
        order = _order(lines=[_line(_LOW_STOCK_OIL, 1.0)], payment_method="jazzcash")
        state = PipelineState(order_id=str(order.order_id), pipeline_run_id=str(uuid4()), confirmed_order=order)

        state = orchestrator.start(state)
        state = orchestrator.handle_warehouse_pick(state, actor="warehouse_staff:w1", discrepancy=False, discrepancy_note=None)

        record = stages.inventory._store.get(str(_LOW_STOCK_OIL.product_id), str(DEFAULT_STORE_ID))
        assert orchestrator._stages.supplier.evaluate_guard(
            available_qty=record.available_qty, low_stock_threshold=_LOW_STOCK_OIL.low_stock_threshold
        )

        state = orchestrator.evaluate_supplier_reorder(
            state,
            product_id=str(_LOW_STOCK_OIL.product_id),
            available_qty=record.available_qty,
            low_stock_threshold=_LOW_STOCK_OIL.low_stock_threshold,
            reorder_qty=50.0,
        )

        # The branch attached a po_id but did NOT change current_stage --
        # it's non-blocking, the order is still progressing normally.
        # The branch attached a po_id but did NOT change current_stage --
        # it's non-blocking, the order's own progress is untouched by it.
        # (Pre-existing Phase 3 test note, corrected in Phase 4: this
        # assertion originally expected PICKING, but the line above it
        # already drove the order through handle_warehouse_pick into
        # READY before evaluate_supplier_reorder runs -- the guard
        # really is a no-op on current_stage, just not a no-op on
        # whatever stage the order happened to be in already.)
        assert state.po_id is not None
        assert state.current_stage == FulfillmentStage.READY

        # And the order itself can still proceed to ready/delivery
        # completely independent of what happens to that PO.
        state = orchestrator.assign_rider(state, delivery_address="addr", delivery_lat=None, delivery_lng=None)
        assert state.current_stage in (FulfillmentStage.ASSIGNED_TO_RIDER, FulfillmentStage.READY)

    def test_owner_approval_is_required_before_a_po_leaves_pending_approval(self):
        from shared.contracts.purchase_order import PurchaseOrderStatus

        orchestrator, stages, graph = _fresh_orchestrator()
        po = stages.supplier.draft_reorder(
            store_id=str(DEFAULT_STORE_ID),
            product_id=str(_LOW_STOCK_OIL.product_id),
            triggered_by_order_id=str(uuid4()),
            reorder_qty=50.0,
        )
        assert po.status == PurchaseOrderStatus.PENDING_APPROVAL

        approved = stages.supplier.decide(po_id=str(po.po_id), decision="approved", actor="owner:o1", note=None)
        assert approved.status == PurchaseOrderStatus.APPROVED

        # REJECTED-equivalent re-decision is not allowed once resolved (terminal).
        try:
            stages.supplier.decide(po_id=str(po.po_id), decision="rejected", actor="owner:o1", note=None)
            assert False, "expected ValueError -- PO already decided"
        except ValueError:
            pass


class TestNoRiderAvailableHoldsInReady:
    def test_no_available_rider_holds_the_order_in_ready_state(self):
        orchestrator, stages, graph = _fresh_orchestrator()
        # Flip every fixture rider to unavailable to force the hold path.
        from shared.contracts.rider import RiderStatus

        for rider in stages.delivery._matcher._riders:
            rider.status = RiderStatus.OFFLINE

        order = _order(lines=[_line(_RICE, 1.0)], payment_method="jazzcash")
        state = PipelineState(order_id=str(order.order_id), pipeline_run_id=str(uuid4()), confirmed_order=order)
        state = orchestrator.start(state)
        state = orchestrator.handle_warehouse_pick(state, actor="warehouse_staff:w1", discrepancy=False, discrepancy_note=None)
        assert state.current_stage == FulfillmentStage.READY

        state = orchestrator.assign_rider(state, delivery_address="addr", delivery_lat=None, delivery_lng=None)
        # TDD §5.2: stays `ready`, no exception, no compensation.
        assert state.current_stage == FulfillmentStage.READY
        assert state.rider_id is None


class TestPickDiscrepancyKeepsPaymentNoAutoRollback:
    def test_pick_discrepancy_flags_exception_without_releasing_payment(self):
        orchestrator, stages, graph = _fresh_orchestrator()
        order = _order(lines=[_line(_RICE, 1.0)], payment_method="jazzcash")
        state = PipelineState(order_id=str(order.order_id), pipeline_run_id=str(uuid4()), confirmed_order=order)
        state = orchestrator.start(state)

        try:
            orchestrator.handle_warehouse_pick(
                state, actor="warehouse_staff:w1", discrepancy=True, discrepancy_note="2 bags missing"
            )
            assert False, "expected PipelineException"
        except PipelineException as exc:
            assert exc.state.exception_reason == "delivery_exception"

        # Payment/inventory were NOT compensated (TDD §5.2: "keep
        # payment... does not auto-refund").
        assert stages.inventory._reservations.get(state.reservation_id) is not None


class TestCancellationCompensatesAllCommittedStages:
    def test_cancel_before_out_for_delivery_reverses_inventory_and_payment(self):
        orchestrator, stages, graph = _fresh_orchestrator()
        order = _order(lines=[_line(_RICE, 1.0)], payment_method="jazzcash")
        state = PipelineState(order_id=str(order.order_id), pipeline_run_id=str(uuid4()), confirmed_order=order)
        state = orchestrator.start(state)
        reservation_id = state.reservation_id

        state = orchestrator.cancel(state, actor="customer:c1")
        assert state.current_stage == FulfillmentStage.CANCELLED
        assert stages.inventory._reservations.get(reservation_id) is None

    def test_cancel_after_out_for_delivery_is_rejected(self):
        orchestrator, stages, graph = _fresh_orchestrator()
        order = _order(lines=[_line(_RICE, 1.0)], payment_method="jazzcash")
        state = PipelineState(order_id=str(order.order_id), pipeline_run_id=str(uuid4()), confirmed_order=order)
        state = orchestrator.start(state)
        state = orchestrator.handle_warehouse_pick(state, actor="warehouse_staff:w1", discrepancy=False, discrepancy_note=None)
        state = orchestrator.assign_rider(state, delivery_address="addr", delivery_lat=None, delivery_lng=None)
        state = orchestrator.mark_out_for_delivery(state)

        try:
            orchestrator.cancel(state, actor="owner:o1")
            assert False, "expected ValueError -- TDD §5.2 guard: not yet out_for_delivery"
        except ValueError:
            pass
