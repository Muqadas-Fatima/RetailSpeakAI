"""
TDD §3.7 — Purchase Order (Supplier Reorder).

Owner-approval gates spend (Plan §1.5): a PO never reaches a supplier
without an explicit interrupt()-gated approval. Reject -> terminal;
a new PO must be drafted fresh if the product is still low on the next
check (Plan §Phase 3 step 6) — REJECTED is not resumable.

CONFIRMED (supplier acked) exists in the enum per TDD, but the
two-way ack protocol itself is an open decision (Plan §6): build the
Supplier stage as one-way-generated-document with an internal
interface seam for later extension, don't wire a live ack integration.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from uuid import UUID

from pydantic import BaseModel


class PurchaseOrderStatus(str, Enum):
    DRAFT = "draft"
    PENDING_APPROVAL = "pending_approval"
    APPROVED = "approved"
    SUBMITTED = "submitted"
    CONFIRMED = "confirmed"  # supplier acked
    RECEIVED = "received"
    REJECTED = "rejected"


class PurchaseOrderLine(BaseModel):
    product_id: UUID
    reorder_qty: float
    unit_cost: float | None = None


class PurchaseOrder(BaseModel):
    po_id: UUID
    store_id: UUID
    supplier_id: UUID
    lines: list[PurchaseOrderLine]
    status: PurchaseOrderStatus
    triggered_by_order_id: UUID | None = None  # order whose reservation crossed threshold
    approved_by: str | None = None
    created_at: datetime
    submitted_at: datetime | None = None
