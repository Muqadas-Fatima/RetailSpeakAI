"""
TDD §3.9 — Delivery / Order Status.

FulfillmentStage is the LangGraph state machine's vocabulary (TDD §5.1)
and the source of truth for `orders.current_stage` / the Postgres
checkpointer. On crash, resume from the last committed checkpoint —
never replay from PLACED (Plan §Phase 3 step 1).
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from uuid import UUID

from pydantic import BaseModel


class FulfillmentStage(str, Enum):
    PLACED = "placed"
    INVENTORY_VERIFIED = "inventory_verified"
    PAYMENT_CONFIRMED = "payment_confirmed"
    PICKING = "picking"
    READY = "ready"
    SUPPLIER_REORDER_PENDING = "supplier_reorder_pending"
    ASSIGNED_TO_RIDER = "assigned_to_rider"
    OUT_FOR_DELIVERY = "out_for_delivery"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"
    FAILED = "failed"


class OrderStatusEvent(BaseModel):
    order_id: UUID
    stage: FulfillmentStage
    occurred_at: datetime
    detail: str | None = None
    actor: str  # "system" | "rider:{id}" | "warehouse_staff:{id}" | "owner:{id}"
