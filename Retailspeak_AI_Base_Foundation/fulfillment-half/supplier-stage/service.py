"""
TDD §2.8 (Supplier stage), §5.2-§5.3 (guard + interrupt), §4.6.

Guard condition (TDD §5.3): evaluated once per order line, after
inventory reservation is finalized, using
`InventoryRecord.available_qty < Product.low_stock_threshold`. This is a
PARALLEL branch, not a blocking gate -- the orchestrator fires this
stage's `reorder()` call fire-and-forget alongside (not before) the
rider-matching step, so a low-stock line never delays the customer's own
order (TDD §5.3).

Owner-approval interrupt (TDD §5.3, §5.1's `[supplier_reorder_pending]*`
state): the PO sits at `pending_approval` until an Owner calls
`reorder-decision`. This is modeled as a plain state transition here
rather than a real `langgraph.interrupt()` call -- see
orchestrator/graph.py's docstring for the seam that will host the real
interrupt() when the `langgraph` package is wired in; this stage's own
logic (draft/approve/reject) doesn't change either way.

REJECTED is terminal (purchase_order.py's own module docstring, TDD
§4.6's rollback column: "Rejection is terminal for that PO, not
retried"). A new PO must be drafted fresh if the product is still low on
the next check -- this module does not resurrect a rejected PO.
"""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID, uuid4

from shared.contracts.purchase_order import PurchaseOrder, PurchaseOrderLine, PurchaseOrderStatus

STAGE_NAME = "supplier"

# TDD §14 / Plan §10: no real supplier integration exists yet (one-way
# generated document, per the Open Decisions placeholder) -- a single
# fixture supplier_id stands in for "the supplier this store reorders
# from," until multi-supplier catalog routing is designed.
_DEFAULT_SUPPLIER_ID = UUID("00000000-0000-0000-0000-000000000055")


class PurchaseOrderNotFoundError(Exception):
    pass


class SupplierStage:
    def __init__(self) -> None:
        self._purchase_orders: dict[str, PurchaseOrder] = {}

    def evaluate_guard(self, *, available_qty: float, low_stock_threshold: float) -> bool:
        """TDD §5.3's exact guard expression, isolated as its own method
        so the orchestrator node and tests can both call it without
        duplicating the comparison."""
        return available_qty < low_stock_threshold

    def draft_reorder(
        self, *, store_id: str, product_id: str, triggered_by_order_id: str, reorder_qty: float
    ) -> PurchaseOrder:
        """System-drafted, per TDD §2.8's table ('PO drafting is
        system-generated'). Lands directly at PENDING_APPROVAL, not
        DRAFT -- there's no separate "Owner reviews an editable draft"
        step in v1 (TDD §5.3's interrupt() pauses the graph at
        pending_approval, not at draft)."""
        po = PurchaseOrder(
            po_id=uuid4(),
            store_id=UUID(store_id),
            supplier_id=_DEFAULT_SUPPLIER_ID,
            lines=[PurchaseOrderLine(product_id=UUID(product_id), reorder_qty=reorder_qty)],
            status=PurchaseOrderStatus.PENDING_APPROVAL,
            triggered_by_order_id=UUID(triggered_by_order_id),
            created_at=datetime.now(timezone.utc),
        )
        self._purchase_orders[str(po.po_id)] = po
        return po

    def decide(self, *, po_id: str, decision: str, actor: str, note: str | None) -> PurchaseOrder:
        po = self._purchase_orders.get(po_id)
        if po is None:
            raise PurchaseOrderNotFoundError(po_id)
        if po.status != PurchaseOrderStatus.PENDING_APPROVAL:
            # Re-deciding an already-decided PO is rejected outright
            # (Plan §1.3: every boundary re-validates) -- REJECTED is
            # terminal, and an already-APPROVED/SUBMITTED PO isn't
            # re-approvable either.
            raise ValueError(f"po {po_id} is not pending_approval (current: {po.status})")

        new_status = PurchaseOrderStatus.APPROVED if decision == "approved" else PurchaseOrderStatus.REJECTED
        updated = po.model_copy(update={"status": new_status, "approved_by": actor})
        self._purchase_orders[po_id] = updated
        return updated

    def list_pending(self, *, store_id: str | None = None) -> list[PurchaseOrder]:
        """Phase 4 — backs `GET /internal/supplier/pending-pos`, the
        Owner dashboard's approval queue. Owner-approval (TDD §5.3's
        `interrupt()`) only ever blocks on POs in this exact status, so
        this is the one query the dashboard actually needs -- APPROVED/
        REJECTED POs are already terminal and belong in an order-history
        view, not the action queue this powers."""
        pos = [po for po in self._purchase_orders.values() if po.status == PurchaseOrderStatus.PENDING_APPROVAL]
        if store_id is not None:
            pos = [po for po in pos if str(po.store_id) == store_id]
        return pos
