"""
fulfillment-half/contracts/pipeline_io.py — request/response shapes for
the six internal stage endpoints (TDD §4.6) the LangGraph orchestrator
drives.

Same rationale as nlu-half/contracts/pipeline_io.py (see that module's
docstring): these are NOT added to shared/contracts/. shared/contracts
(Execution Plan §1.7) is the fixed, ten-model, cross-half boundary set —
the only artifact nlu-half ever hands fulfillment-half is a signed
ConfirmedOrder built from shared.contracts.order. Everything below is
intra-fulfillment-half plumbing between the orchestrator and its stage
services; nlu-half never imports it.

Every request model carries `order_id` (or is reachable from one) so the
Idempotency-Key (`f"{order_id}:{stage_name}:{attempt_seq}"`, TDD §5.5)
can always be constructed by the caller without extra lookups.
"""

from __future__ import annotations

from enum import Enum

from pydantic import BaseModel

from shared.contracts.order import OrderLineItem
from shared.contracts.purchase_order import PurchaseOrderStatus


# --- POST /internal/inventory/reserve, /internal/inventory/release (TDD §4.6) ---


class ReserveLineItem(BaseModel):
    product_id: str
    quantity: float


class ReserveInventoryRequest(BaseModel):
    order_id: str
    store_id: str
    line_items: list[ReserveLineItem]


class ReservedLine(BaseModel):
    product_id: str
    reserved_qty: float


class ReservationStatus(str, Enum):
    RESERVED = "reserved"
    UNAVAILABLE = "unavailable"


class ReserveInventoryResponse(BaseModel):
    reservation_id: str | None = None  # None iff status == UNAVAILABLE
    lines: list[ReservedLine] = []
    status: ReservationStatus
    # Populated only on UNAVAILABLE — which line(s) couldn't be reserved
    # and why, so the orchestrator's exception path (-> inventory_unavailable,
    # TDD §5.2) has something concrete to surface, not just a bare failure.
    unavailable_lines: list[str] = []


class ReleaseInventoryRequest(BaseModel):
    reservation_id: str
    reason: str  # "payment_failed" | "cancelled" | "compensating_rollback"


class ReleaseInventoryResponse(BaseModel):
    reservation_id: str
    status: str  # "released"


# --- POST /internal/payment/charge (TDD §4.6) ---


class ChargePaymentRequest(BaseModel):
    order_id: str
    amount: float
    payment_method: str  # "jazzcash" | "easypaisa"
    line_items: list[OrderLineItem]  # server re-derives amount from these (TDD §8.2)


class PaymentStatus(str, Enum):
    SUCCESS = "success"
    DECLINED = "declined"
    TIMEOUT = "timeout"


class ChargePaymentResponse(BaseModel):
    transaction_ref: str | None = None
    status: PaymentStatus


# --- POST /internal/khata/post (TDD §4.6) ---


class PostKhataRequest(BaseModel):
    customer_id: str
    store_id: str
    order_id: str
    amount: float


class PostKhataResponse(BaseModel):
    entry_id: str | None = None
    new_balance: float | None = None
    # TDD §4.6: over credit-limit -> 422, pipeline routes to payment_failed.
    # Modeled here as a status field (not an HTTP exception) so the
    # orchestrator's guard logic can branch on it directly in-process;
    # the real HTTP layer (api.py) still returns 422 for the wire case.
    over_limit: bool = False


# --- POST /internal/warehouse/pick (TDD §4.6 — human actor: Warehouse Staff) ---


class WarehousePickRequest(BaseModel):
    order_id: str
    reservation_id: str
    actor: str  # "warehouse_staff:{id}" (TDD §4.6)
    discrepancy: bool = False
    discrepancy_note: str | None = None


class WarehousePickResponse(BaseModel):
    pick_list_id: str
    status: str  # "ready" | "exception"
    picked_by: str


# --- POST /internal/supplier/reorder, /internal/supplier/reorder-decision (TDD §4.6) ---


class SupplierReorderRequest(BaseModel):
    store_id: str
    product_id: str
    triggered_by_order_id: str
    current_qty: float
    threshold: float
    reorder_qty: float


class SupplierReorderResponse(BaseModel):
    po_id: str
    status: PurchaseOrderStatus


class SupplierReorderDecisionRequest(BaseModel):
    po_id: str
    decision: str  # "approved" | "rejected"
    actor: str  # "owner:{id}" (TDD §4.6)
    note: str | None = None


class SupplierReorderDecisionResponse(BaseModel):
    po_id: str
    status: PurchaseOrderStatus


# --- POST /internal/delivery/assign (TDD §4.6) ---


class DeliveryAssignRequest(BaseModel):
    order_id: str
    store_id: str
    delivery_address: str
    delivery_lat: float | None = None
    delivery_lng: float | None = None


class DeliveryAssignResponse(BaseModel):
    rider_id: str | None = None  # None iff no rider was available
    route_id: str | None = None
    eta: str | None = None
    held: bool = False  # TDD §5.2: no rider -> stays "ready", retried on timer


# --- POST /internal/notify/send (TDD §4.6) ---


class NotifySendRequest(BaseModel):
    order_id: str
    stage: str
    channel: str  # "sms" | "whatsapp" | "dashboard_ws" | "voice_tts"


class NotifySendResponse(BaseModel):
    delivery_status: str  # "sent" | "queued_for_retry" | "failed"
