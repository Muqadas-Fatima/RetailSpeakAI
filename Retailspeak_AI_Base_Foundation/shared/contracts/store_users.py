"""
TDD §3.4 — Store Users: Owner and Warehouse Staff.

Both roles are internal, store-side accounts (as opposed to Customer,
who is external, and Rider, who is field-based) and share one table,
distinguished by `role`. Backs the owner/warehouse_staff JWT role
claims (TDD §8.1) — there is no generic "staff" role (Plan §0).

Note (Plan §6, Open Decisions): exactly one active `owner` per store,
enforced at the application layer — not a DB constraint, since
"multi-owner/delegate support" is an explicit open decision. Do not
build ahead of it.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from uuid import UUID

from pydantic import BaseModel


class StoreUserRole(str, Enum):
    OWNER = "owner"
    WAREHOUSE_STAFF = "warehouse_staff"


class StoreUser(BaseModel):
    user_id: UUID
    store_id: UUID
    role: StoreUserRole
    name: str
    email: str
    phone_number: str | None = None
    is_active: bool = True
    created_at: datetime


class OwnerApproval(BaseModel):
    """Emitted when an Owner resolves a pending Supplier PO via interrupt() (TDD §5.3)."""

    po_id: UUID
    owner_user_id: UUID
    decision: str  # "approved" | "rejected"
    note: str | None = None
    decided_at: datetime
