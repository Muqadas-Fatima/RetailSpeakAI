"""
TDD §3.5, §5.3, §7.2 (pattern reused), §12 — Khata ledger posting.

The khata reconciliation property is: `running_balance_after` sums
EXACTLY to the sequential sum of `amount` regardless of execution order
under concurrent bursts (TDD §12). That property only holds if the
credit-limit check and the balance mutation happen inside the SAME
per-customer lock -- check-then-act across two separate operations is
exactly the race this module exists to prevent, mirroring the
inventory-stage row-lock pattern (Foundation Plan §4.3) applied to
`customer_id` instead of `(product_id, store_id)`.

`current_balance + order_total <= khata_credit_limit` (Plan §Phase 3
step 4 / TDD §5.3) is evaluated INSIDE the lock, immediately before the
entry is written -- never as a separate pre-check the caller does first
and trusts.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from threading import Lock
from uuid import uuid4

from shared.contracts.customer import Customer
from shared.contracts.khata import KhataEntry, KhataEntryType


class OverCreditLimitError(Exception):
    """Raised inside the lock when current_balance + amount would exceed
    khata_credit_limit. Business-logic failure (TDD §5.5) -- the
    orchestrator does NOT retry this, it routes straight to
    `payment_failed` (TDD §5.2)."""


class KhataNotEnabledError(Exception):
    """Raised when the customer isn't khata_enabled at all -- distinct
    from over-limit so the reprompt/error text can be specific."""


@dataclass
class _CustomerLedgerRow:
    customer: Customer
    balance: float = 0.0
    lock: Lock = field(default_factory=Lock)


class InMemoryKhataLedger:
    """Phase 3 mock for `customers` + `khata_entries` (TDD §9.1). One
    lock per customer_id -- concurrent credit sales against DIFFERENT
    customers never contend, only same-customer bursts serialize, which
    is exactly the property the khata reconciliation test in
    tests/property/ exercises."""

    def __init__(self, customers: list[Customer]) -> None:
        self._rows: dict[str, _CustomerLedgerRow] = {
            str(c.customer_id): _CustomerLedgerRow(customer=c) for c in customers
        }
        self._entries: list[KhataEntry] = []

    def post_credit_sale(self, *, customer_id: str, store_id: str, order_id: str, amount: float) -> KhataEntry:
        row = self._row(customer_id)
        with row.lock:
            if not row.customer.khata_enabled:
                raise KhataNotEnabledError(f"customer {customer_id} is not khata_enabled")
            limit = row.customer.khata_credit_limit or 0.0
            if row.balance + amount > limit:
                raise OverCreditLimitError(
                    f"customer {customer_id}: balance {row.balance} + amount {amount} > limit {limit}"
                )
            row.balance += amount
            entry = KhataEntry(
                entry_id=uuid4(),
                customer_id=row.customer.customer_id,
                store_id=row.customer.store_id,
                order_id=order_id,
                entry_type=KhataEntryType.CREDIT_SALE,
                amount=amount,
                running_balance_after=row.balance,
                created_at=datetime.now(timezone.utc),
                created_by="system",
            )
            self._entries.append(entry)
            return entry

    def reverse(self, *, customer_id: str, order_id: str, amount: float) -> KhataEntry:
        """Compensation for a cancelled order that was on khata (TDD
        §5.2's cancellation row: "reverse payment or khata entry").
        Posted as a negative-amount ADJUSTMENT entry rather than deleting
        the original CREDIT_SALE row -- the ledger is append-only, per
        khata.py's own module docstring ("do not treat this model as
        append-only decoration")."""
        row = self._row(customer_id)
        with row.lock:
            row.balance -= amount
            entry = KhataEntry(
                entry_id=uuid4(),
                customer_id=row.customer.customer_id,
                store_id=row.customer.store_id,
                order_id=order_id,
                entry_type=KhataEntryType.ADJUSTMENT,
                amount=-amount,
                running_balance_after=row.balance,
                created_at=datetime.now(timezone.utc),
                created_by="system",
                note="reversal: order cancelled after khata post",
            )
            self._entries.append(entry)
            return entry

    def balance_of(self, customer_id: str) -> float:
        row = self._row(customer_id)
        with row.lock:
            return row.balance

    def entries_for(self, customer_id: str) -> list[KhataEntry]:
        return [e for e in self._entries if str(e.customer_id) == customer_id]

    def _row(self, customer_id: str) -> _CustomerLedgerRow:
        if customer_id not in self._rows:
            raise KeyError(f"no customer row for {customer_id}")
        return self._rows[customer_id]
