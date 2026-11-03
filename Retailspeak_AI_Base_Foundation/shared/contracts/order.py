"""
TDD §3.1 — Order JSON, the LLM's output contract, and ConfirmedOrder,
the single signed artifact that crosses the NLU-half / fulfillment-half
boundary (Plan §1.1). Nothing in fulfillment-half trusts anything from
nlu-half beyond a ConfirmedOrder with a verified confirmation_signature.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class OrderIntent(str, Enum):
    ADD_ITEM = "add_item"
    MODIFY_ITEM = "modify_item"
    REMOVE_ITEM = "remove_item"
    CONFIRM = "confirm"
    CANCEL = "cancel"


class OrderLineItem(BaseModel):
    line_id: str  # client-generated, stable across corrections
    product_id: UUID | None = None  # None until RAG-matched + validated
    matched_name: str  # canonical catalog name, not raw utterance
    raw_mention: str  # original spoken/typed phrase, for audit
    quantity: float = Field(gt=0)
    unit: str  # must match Product.unit
    unit_price: float | None = None  # populated at validation time from catalog
    substitution_of: str | None = None  # line_id this replaces, if any
    confidence: float = Field(ge=0, le=1)

    @field_validator("quantity")
    @classmethod
    def quantity_reasonable(cls, v: float) -> float:
        if v > 500:
            raise ValueError(
                "quantity exceeds sane per-order ceiling; confirm with customer"
            )
        return v


class OrderJSON(BaseModel):
    session_id: UUID
    store_id: UUID
    customer_id: UUID | None = None  # None for guest/unregistered caller
    language_mix: list[str]  # e.g. ["ur", "en"] detected in session
    intent: OrderIntent
    line_items: list[OrderLineItem]
    payment_method: str | None = None  # "jazzcash" | "easypaisa" | "khata"
    confirmed: bool = False
    confirmed_at: datetime | None = None
    created_at: datetime
    schema_version: str = "1.0"


class ConfirmedOrder(OrderJSON):
    """
    Post-validation, pre-pipeline addition (TDD §3.1). Stamped and signed
    by the orchestrator only after Pydantic-accepted + customer-confirmed.

    This is the ONE artifact referenced in Plan §1.1 — the exactly-one
    handoff between the two halves, submitted via
    POST /v1/fulfillment/orders (TDD §4.5). Server re-verifies
    confirmation_signature before enqueueing into LangGraph; missing/
    invalid signature -> 409, never enters fulfillment.
    """

    order_id: UUID
    confirmation_signature: str  # HMAC over the frozen JSON, prevents mutation after confirm
    total_amount: float
