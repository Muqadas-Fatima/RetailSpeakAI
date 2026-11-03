"""
ORM models for the tables the NLU/grounding half actually touches:
Store and Product (catalog + embeddings). Order/Khata/Inventory/etc. are
system-of-record tables owned by the fulfillment half (Foundation Plan
§2.2) — this half only ever *reads* catalog data to ground mentions; it
never writes fulfillment state.

TDD §3.2 (Product), §9.1 (store_id FK throughout, single-store-per-record
per the Foundation Plan §10 decision to not speculatively add multi-tenancy).
"""
import uuid
from datetime import datetime, UTC

from pgvector.sqlalchemy import Vector
from sqlalchemy import Boolean, DateTime, ForeignKey, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.config import get_settings
from app.database import Base

settings = get_settings()


class Store(Base):
    __tablename__ = "stores"

    store_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    timezone: Mapped[str] = mapped_column(String(64), default="Asia/Karachi", nullable=False)

    # Per-store tunable RAG thresholds — Foundation Plan §10: "implemented
    # as a tunable per-store config value, not a hardcoded constant."
    # NULL means "fall back to the process-wide default in Settings".
    rag_similarity_floor: Mapped[float | None] = mapped_column(Numeric(4, 3), nullable=True)
    rag_auto_accept_threshold: Mapped[float | None] = mapped_column(Numeric(4, 3), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))

    products: Mapped[list["Product"]] = relationship(back_populates="store")


class Product(Base):
    """TDD §3.2 Product — catalog entry with bilingual name fields and
    the embedding vector RAG retrieval queries against (TDD §2.4)."""

    __tablename__ = "products"

    product_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    store_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("stores.store_id"), nullable=False, index=True)

    name_en: Mapped[str] = mapped_column(String(255), nullable=False)
    name_ur: Mapped[str | None] = mapped_column(String(255), nullable=True)
    name_roman_ur: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # Additional free-text aliases (e.g. "chawal", "basmati") folded into
    # the embedding input at index time — see rag_service.build_embedding_text.
    aliases: Mapped[str | None] = mapped_column(Text, nullable=True)

    unit: Mapped[str] = mapped_column(String(32), nullable=False)  # kg, pcs, dozen, litre, ...
    price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    in_stock_qty: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    max_order_qty: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # BGE-Small-EN-v1.5 is 384-dim — TDD §2.4, §14.
    embedding: Mapped[list[float] | None] = mapped_column(Vector(384), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC)
    )

    store: Mapped["Store"] = relationship(back_populates="products")
