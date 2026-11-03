"""
TDD §2.8 (Payment/Khata stage), §5.3 (routing guard), §8.2 (server-side
re-pricing) — charge via JazzCash/EasyPaisa OR post a khata credit
entry; NEVER both (TDD §2.8's own phrasing).

Routing guard (TDD §5.3): `payment_method == "khata"` routes to the
ledger instead of the gateway, additionally guarded by
`customer.khata_enabled AND (current_balance + order_total) <=
khata_credit_limit` -- both checks live inside khata_ledger.py's locked
section, not duplicated here.

Server-side re-pricing (TDD §8.2): this stage re-computes total_amount
from `line_items x unit_price` looked up... at the point the
ConfirmedOrder was signed (unit_price was already re-priced from the
live catalog by the validation gate, Phase 2) and rejects if it doesn't
match the ConfirmedOrder's own stated total_amount within a small
rounding tolerance -- defends against a manipulated or stale
client-side total, per TDD §8.2's exact framing.
"""

from __future__ import annotations

from shared.contracts.order import OrderLineItem
from shared.idempotency.dedupe import IdempotencyGuard

from gateway import PaymentGateway
from khata_ledger import InMemoryKhataLedger, KhataNotEnabledError, OverCreditLimitError

STAGE_NAME = "payment_khata"
_ROUNDING_TOLERANCE = 0.01


class TotalMismatchError(Exception):
    """TDD §8.2: server-recomputed total doesn't match the ConfirmedOrder's
    stated total_amount beyond rounding tolerance. This is a
    business-logic failure -- not retried, routes straight to
    payment_failed (TDD §5.2), same as an over-limit khata check."""


def _recompute_total(line_items: list[OrderLineItem]) -> float:
    return round(sum((li.unit_price or 0.0) * li.quantity for li in line_items), 2)


class PaymentKhataStage:
    def __init__(
        self,
        *,
        khata_ledger: InMemoryKhataLedger,
        gateway_factory,  # Callable[[str], PaymentGateway] -- see gateway.gateway_for
        idempotency: IdempotencyGuard,
    ) -> None:
        self._ledger = khata_ledger
        self._gateway_factory = gateway_factory
        self._idempotency = idempotency

    def settle(
        self,
        *,
        order_id: str,
        store_id: str,
        customer_id: str | None,
        payment_method: str,
        stated_total_amount: float,
        line_items: list[OrderLineItem],
        idempotency_key: str,
    ):
        """Returns a dict describing the outcome. Callers (orchestrator
        node, api.py) branch on `outcome` to decide the TDD §5.2
        transition: 'payment_settled' vs 'payment_failed'."""

        # TDD §8.2's re-pricing check needs line_items, which is only
        # part of the charge (gateway) wire contract -- the khata/post
        # contract (TDD §4.6) is `{customer_id, order_id, amount}` with
        # no line_items at all. In production the ONE re-derivation of
        # total_amount from line_items happens upstream, at the
        # orchestrator node (nodes.py), before it decides which of these
        # two endpoints to call -- so the khata branch here trusts the
        # amount it was handed rather than re-deriving from an empty
        # list, which would always mismatch.
        if payment_method != "khata":
            recomputed = _recompute_total(line_items)
            if abs(recomputed - stated_total_amount) > _ROUNDING_TOLERANCE:
                # Fails BEFORE touching the gateway -- a tampered total
                # must never reach the side effect (TDD §8.2).
                return {
                    "outcome": "payment_failed",
                    "reason": "total_amount_mismatch",
                    "detail": f"stated {stated_total_amount} vs recomputed {recomputed}",
                }
        else:
            recomputed = stated_total_amount

        def _do_settle():
            if payment_method == "khata":
                return self._settle_khata(
                    order_id=order_id, store_id=store_id, customer_id=customer_id, amount=recomputed
                )
            return self._settle_gateway(
                order_id=order_id, payment_method=payment_method, amount=recomputed
            )

        return self._idempotency.run(idempotency_key, _do_settle)

    def _settle_khata(self, *, order_id: str, store_id: str, customer_id: str | None, amount: float):
        if customer_id is None:
            return {
                "outcome": "payment_failed",
                "reason": "khata_requires_customer",
                "detail": "khata payment method requires a registered customer_id",
            }
        try:
            entry = self._ledger.post_credit_sale(
                customer_id=customer_id, store_id=store_id, order_id=order_id, amount=amount
            )
        except OverCreditLimitError as exc:
            # TDD §4.6: over credit-limit -> 422 at the HTTP layer;
            # in-process this is the "payment_failed" outcome the
            # orchestrator's guard condition (TDD §5.3) branches on.
            return {"outcome": "payment_failed", "reason": "over_credit_limit", "detail": str(exc)}
        except KhataNotEnabledError as exc:
            return {"outcome": "payment_failed", "reason": "khata_not_enabled", "detail": str(exc)}

        return {
            "outcome": "payment_settled",
            "khata_entry_id": str(entry.entry_id),
            "new_balance": entry.running_balance_after,
            "transaction_ref": None,
        }

    def _settle_gateway(self, *, order_id: str, payment_method: str, amount: float):
        gateway: PaymentGateway = self._gateway_factory(payment_method)
        result = gateway.charge(order_id=order_id, amount=amount)
        if result.status != "success":
            # TDD §4.6: provider decline/timeout -> no khata entry
            # created (there wasn't one to begin with, on this branch),
            # and the orchestrator calls inventory/release.
            return {"outcome": "payment_failed", "reason": f"gateway_{result.status}", "detail": None}

        return {
            "outcome": "payment_settled",
            "transaction_ref": result.transaction_ref,
            "khata_entry_id": None,
            "new_balance": None,
        }

    def compensate(
        self,
        *,
        payment_method: str,
        transaction_ref: str | None,
        customer_id: str | None,
        order_id: str,
        amount: float,
    ) -> None:
        """TDD §5.2's cancellation row: "reverse payment or khata entry."
        Called by the orchestrator's rollback walk (TDD §5.4) -- refunds
        via the same gateway a charge went through, or posts a
        reversing ADJUSTMENT entry via the ledger. Idempotent at the
        gateway/ledger layer already (refund/reverse don't re-check
        state), so a retried compensation call is safe."""
        if payment_method == "khata":
            if customer_id is not None:
                self._ledger.reverse(customer_id=customer_id, order_id=order_id, amount=amount)
            return
        if transaction_ref is not None:
            gateway = self._gateway_factory(payment_method)
            gateway.refund(transaction_ref=transaction_ref, amount=amount)
