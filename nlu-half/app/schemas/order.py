"""
Order contracts — the ONE handoff artifact between the NLU/grounding half
and the fulfillment half (TDD §1, §3.1; Foundation Plan §1, §2.4).

`OrderJSON` is the mutable, in-progress draft that lives in Redis session
state across turns. `ConfirmedOrder` is the immutable, signed object that
crosses the boundary via `POST /v1/fulfillment/orders` — this half
constructs it but never submits it anywhere past validation; that HTTP
call belongs to the dialogue-manager/confirmation-turn layer, not to any
of the five services built here.

This file is the canonical source that `shared/contracts/order.py` in the
monorepo layout (Foundation Plan §2.2) should re-export from, so the two
halves never maintain divergent copies of this schema.
"""
import hashlib
import hmac
import uuid
from datetime import datetime, UTC
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field, field_validator


class OrderIntent(str, Enum):
    ADD_ITEM = "add_item"
    MODIFY_ITEM = "modify_item"
    REMOVE_ITEM = "remove_item"
    CONFIRM = "confirm"
    CANCEL = "cancel"


class OrderLineItem(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    line_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    product_id: uuid.UUID
    matched_name: str
    quantity: float = Field(gt=0)
    unit: str
    unit_price: float = Field(ge=0)
    raw_mention: str  # what the customer actually said, kept for audit/debugging

    @field_validator("quantity")
    @classmethod
    def quantity_must_be_positive(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("quantity must be greater than zero")
        return v

    @property
    def line_total(self) -> float:
        return round(self.quantity * self.unit_price, 2)


class DraftOrderJSON(BaseModel):
    """Unvalidated draft as emitted by the LLM grounding layer (TDD §2.5,
    §4.4) — this is what the Pydantic validation gate (§2.6) consumes."""

    model_config = ConfigDict(str_strip_whitespace=True)

    session_id: str
    store_id: uuid.UUID
    customer_id: uuid.UUID | None = None
    intent: OrderIntent
    lines: list[OrderLineItem] = Field(default_factory=list)
    language_mix: list[str] = Field(default_factory=list)  # e.g. ["ur", "en"] — PRD §2.2
    channel: str = Field(pattern="^(voice|chat)$")
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


class OrderJSON(DraftOrderJSON):
    """A DraftOrderJSON that has passed the validation gate — every
    product_id is confirmed to exist in the live catalog (TDD §2.6)."""

    validated: bool = True
    validated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


class ConfirmedOrder(OrderJSON):
    """Immutable, HMAC-signed order — the sole cross-boundary handoff
    artifact (Foundation Plan §1, §10). Only produced after the customer's
    explicit confirmation turn (TDD §4.5); a tampered or missing signature
    must be rejected outright by the fulfillment half (PRD §7)."""

    confirmed_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    signature: str

    @staticmethod
    def compute_signature(payload: str, secret_key: str) -> str:
        return hmac.new(secret_key.encode(), payload.encode(), hashlib.sha256).hexdigest()

    def verify_signature(self, secret_key: str) -> bool:
        unsigned = self.model_copy(update={"signature": ""})
        expected = self.compute_signature(
            unsigned.model_dump_json(exclude={"signature"}), secret_key
        )
        return hmac.compare_digest(expected, self.signature)


class ValidationError(BaseModel):
    line_id: str | None = None
    raw_mention: str | None = None
    reason: str
    code: str  # e.g. "product_not_in_catalog", "quantity_exceeds_max", "quantity_not_positive"


class ValidationResult(BaseModel):
    valid: bool
    order: OrderJSON | None = None
    errors: list[ValidationError] = Field(default_factory=list)
