"""
TDD §3.1 / §4.5 — HMAC signing of a gate-accepted, customer-confirmed
OrderJSON into the one artifact fulfillment-half ever consumes:
ConfirmedOrder, carrying order_id, confirmation_signature, and
total_amount. TDD §4.5: the fulfillment-order endpoint re-verifies
confirmation_signature server-side before enqueueing into LangGraph --
missing/invalid signature -> 409, never enters fulfillment. That
verification lives on the fulfillment-half side (Phase 3, not built
yet); this module owns the signing half and exposes `verify` so
fulfillment-half's Phase 3 endpoint can share the exact same signer
implementation rather than re-deriving the HMAC scheme independently.

Phase 2 dev-mode key material: HMAC_SIGNING_SECRET env var. Production
signs via AWS KMS (infra/dev/.env.example's KMS_KEY_ID names the CMK) --
swap HMACOrderSigner's key-loading for a KMS-backed one without changing
OrderSigner's interface or any caller (sign/verify signatures stay
identical either way).
"""

from __future__ import annotations

import hashlib
import hmac
import json
import os
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from uuid import UUID, uuid4

from shared.contracts.order import ConfirmedOrder, OrderJSON

_DEV_FALLBACK_SECRET = b"dev-insecure-signing-secret-do-not-use-in-prod"


def _canonical_payload(order: OrderJSON, order_id: UUID, total_amount: float) -> bytes:
    """
    Deterministic, sorted-key JSON serialization -- the same logical
    order always signs to the same bytes regardless of dict/field
    ordering, so `sign` and `verify` agree even across process restarts
    or different code paths building the same order. `confirmed` and
    `confirmed_at` are part of the signed payload deliberately: the
    signature is over the FROZEN, confirmed state (TDD §3.1's "prevents
    mutation after confirm" covers the confirmation flag itself, not
    just line items).
    """
    payload = order.model_dump(mode="json")
    payload["order_id"] = str(order_id)
    payload["total_amount"] = total_amount
    return json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")


class OrderSigner(ABC):
    @abstractmethod
    def sign_and_stamp(self, validated_order: OrderJSON) -> ConfirmedOrder:
        """Stamps order_id/confirmed/confirmed_at/total_amount onto a
        gate-accepted OrderJSON and returns the signed ConfirmedOrder."""
        ...

    @abstractmethod
    def verify(self, confirmed_order: ConfirmedOrder) -> bool:
        """Re-derives the expected signature and compares in constant
        time (TDD §4.5's re-verification, shared here so Phase 3's
        POST /v1/fulfillment/orders can reuse it verbatim)."""
        ...


class HMACOrderSigner(OrderSigner):
    def __init__(self, secret_key: bytes | None = None) -> None:
        env_secret = os.environ.get("HMAC_SIGNING_SECRET")
        self._secret_key = secret_key or (env_secret.encode("utf-8") if env_secret else _DEV_FALLBACK_SECRET)

    def sign_and_stamp(self, validated_order: OrderJSON) -> ConfirmedOrder:
        if validated_order.confirmed:
            # A ConfirmedOrder is not re-confirmable -- signing is a
            # one-way stamp, not idempotent-by-accident (Plan §1: exactly
            # one handoff artifact per order).
            raise ValueError("order is already confirmed; cannot re-sign")
        if not validated_order.line_items:
            raise ValueError("cannot confirm an order with no line items")

        order_id = uuid4()
        confirmed_at = datetime.now(timezone.utc)
        frozen_order = validated_order.model_copy(update={"confirmed": True, "confirmed_at": confirmed_at})
        total_amount = round(
            sum((li.unit_price or 0.0) * li.quantity for li in frozen_order.line_items), 2
        )

        signature = self._sign(frozen_order, order_id, total_amount)

        return ConfirmedOrder(
            **frozen_order.model_dump(),
            order_id=order_id,
            confirmation_signature=signature,
            total_amount=total_amount,
        )

    def verify(self, confirmed_order: ConfirmedOrder) -> bool:
        base_order = OrderJSON(
            **confirmed_order.model_dump(exclude={"order_id", "confirmation_signature", "total_amount"})
        )
        expected = self._sign(base_order, confirmed_order.order_id, confirmed_order.total_amount)
        return hmac.compare_digest(expected, confirmed_order.confirmation_signature)

    def _sign(self, order: OrderJSON, order_id: UUID, total_amount: float) -> str:
        mac = hmac.new(self._secret_key, _canonical_payload(order, order_id, total_amount), hashlib.sha256)
        return mac.hexdigest()
