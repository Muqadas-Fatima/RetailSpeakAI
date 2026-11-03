"""
Phase 2 — HMAC confirmation-signing unit tests (TDD §3.1, §4.5).

TDD §4.5: "Server re-verifies confirmation_signature before enqueueing
into LangGraph -- a request with a missing/invalid signature is rejected
with 409, since an unconfirmed or tampered order must never enter
fulfillment." The actual 409 HTTP behavior is Phase 3's fulfillment-order
endpoint (not built yet); this file proves the underlying verify()
primitive that endpoint will call actually catches tampering, which is
the property the 409 depends on.
"""

from __future__ import annotations

import os
import sys
from datetime import datetime, timezone
from uuid import uuid4

_REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
_NLU_HALF = os.path.join(_REPO_ROOT, "nlu-half")

for path in (_REPO_ROOT, os.path.join(_NLU_HALF, "validation-gate")):
    if path not in sys.path:
        sys.path.insert(0, path)

from shared.contracts.order import OrderIntent, OrderJSON, OrderLineItem
from signer import HMACOrderSigner


def _validated_order(**overrides) -> OrderJSON:
    defaults = dict(
        session_id=uuid4(),
        store_id=uuid4(),
        customer_id=None,
        language_mix=["ur"],
        intent=OrderIntent.ADD_ITEM,
        line_items=[
            OrderLineItem(
                line_id="l1",
                product_id=uuid4(),
                matched_name="Basmati Rice",
                raw_mention="chawal",
                quantity=2,
                unit="kg",
                unit_price=320.0,
                confidence=1.0,
            )
        ],
        payment_method="khata",
        confirmed=False,
        created_at=datetime.now(timezone.utc),
    )
    defaults.update(overrides)
    return OrderJSON(**defaults)


class TestHMACOrderSigner:
    def test_sign_and_stamp_produces_a_verifiable_confirmed_order(self):
        signer = HMACOrderSigner(secret_key=b"test-secret")
        confirmed = signer.sign_and_stamp(_validated_order())

        assert confirmed.confirmed is True
        assert confirmed.confirmed_at is not None
        assert confirmed.total_amount == 640.0  # 2 * 320.0
        assert signer.verify(confirmed) is True

    def test_verify_fails_after_line_item_tampered(self):
        signer = HMACOrderSigner(secret_key=b"test-secret")
        confirmed = signer.sign_and_stamp(_validated_order())

        tampered = confirmed.model_copy(
            update={
                "line_items": [
                    li.model_copy(update={"quantity": 500}) for li in confirmed.line_items
                ]
            }
        )
        assert signer.verify(tampered) is False

    def test_verify_fails_after_total_amount_tampered(self):
        signer = HMACOrderSigner(secret_key=b"test-secret")
        confirmed = signer.sign_and_stamp(_validated_order())

        tampered = confirmed.model_copy(update={"total_amount": 1.0})
        assert signer.verify(tampered) is False

    def test_verify_fails_with_wrong_key(self):
        signer_a = HMACOrderSigner(secret_key=b"key-a")
        signer_b = HMACOrderSigner(secret_key=b"key-b")
        confirmed = signer_a.sign_and_stamp(_validated_order())

        assert signer_b.verify(confirmed) is False

    def test_cannot_sign_an_already_confirmed_order(self):
        signer = HMACOrderSigner(secret_key=b"test-secret")
        already_confirmed = _validated_order(confirmed=True, confirmed_at=datetime.now(timezone.utc))

        try:
            signer.sign_and_stamp(already_confirmed)
            assert False, "expected ValueError"
        except ValueError:
            pass

    def test_cannot_sign_an_order_with_no_line_items(self):
        signer = HMACOrderSigner(secret_key=b"test-secret")
        empty_order = _validated_order(line_items=[])

        try:
            signer.sign_and_stamp(empty_order)
            assert False, "expected ValueError"
        except ValueError:
            pass
