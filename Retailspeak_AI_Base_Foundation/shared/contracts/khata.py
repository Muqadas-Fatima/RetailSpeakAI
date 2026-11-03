"""
TDD §3.5 — Khata Ledger Entry.

running_balance_after must sum exactly regardless of execution order
under concurrent bursts — this is the property the reconciliation
test (Plan §5, written alongside the Payment/Khata stage in Phase 3)
asserts. Do not treat this model as append-only decoration; the
credit-limit check (current_balance + order_total <= khata_credit_limit)
happens BEFORE any entry here is written (Plan §Phase 3 step 4).
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from uuid import UUID

from pydantic import BaseModel


class KhataEntryType(str, Enum):
    CREDIT_SALE = "credit_sale"
    REPAYMENT = "repayment"
    ADJUSTMENT = "adjustment"


class KhataEntry(BaseModel):
    entry_id: UUID
    customer_id: UUID
    store_id: UUID
    order_id: UUID | None = None
    entry_type: KhataEntryType
    amount: float  # positive = increases balance owed
    running_balance_after: float
    note: str | None = None
    created_at: datetime
    created_by: str  # "system" | "owner:{user_id}" | "warehouse_staff:{user_id}"
