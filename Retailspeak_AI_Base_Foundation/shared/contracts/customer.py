"""TDD §3.3 — Customer."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class Customer(BaseModel):
    customer_id: UUID
    store_id: UUID
    phone_number: str  # E.164, primary identifier (stored AES-encrypted at rest, TDD §8.3)
    name: str | None = None
    preferred_language: str  # "ur" | "en" | "roman_ur"
    khata_enabled: bool = False
    khata_credit_limit: float | None = None
    created_at: datetime
