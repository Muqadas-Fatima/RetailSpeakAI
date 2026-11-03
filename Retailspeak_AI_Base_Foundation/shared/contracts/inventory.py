"""
TDD §3.6 — Inventory Record.

available_qty is a computed value (on_hand_qty - reserved_qty) and must
NEVER be trusted as a cached read for a reserve decision (TDD §7.2) —
the reserve transaction always re-derives it inside a
`SELECT ... FOR UPDATE` row lock. `version` is the optimistic-lock
counter used for Warehouse Staff manual stock-count compare-and-swap
edits (TDD §7.2), separate from the reservation row lock.
"""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class InventoryRecord(BaseModel):
    product_id: UUID
    store_id: UUID
    on_hand_qty: float
    reserved_qty: float  # sum of active reservations
    available_qty: float  # on_hand_qty - reserved_qty (computed, never authoritative on its own)
    last_counted_at: datetime | None = None
    version: int  # optimistic-lock counter
