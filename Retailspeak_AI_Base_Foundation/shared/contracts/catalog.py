"""
TDD §3.2 — Product / Catalog.

Embedding-propagation split (Plan §Phase 1): price, in_stock_qty, and
is_active are always live-joined at query time, never embedded/cached.
Only name_en/name_ur/name_roman_ur/aliases go through the re-embedding
queue (sub-5-second propagation via Postgres trigger, TDD §6.2).
"""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class Product(BaseModel):
    product_id: UUID
    store_id: UUID
    name_en: str
    name_ur: str
    name_roman_ur: str
    aliases: list[str] = []  # extra matching strings (brand slang, etc.)
    category: str
    unit: str  # "kg" | "pcs" | "litre" | ...
    price: float
    in_stock_qty: float
    low_stock_threshold: float
    embedding_id: UUID  # FK to pgvector row
    is_active: bool = True
    updated_at: datetime
