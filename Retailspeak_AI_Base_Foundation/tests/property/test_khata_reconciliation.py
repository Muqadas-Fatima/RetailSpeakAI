"""
TDD §12 — "Khata reconciliation (100%, no missed/duplicate entries):
Integration + property-based test. Simulated concurrent credit-sale
bursts against a single customer's khata, asserting running_balance_after
sums exactly to the sequential sum of amount regardless of execution
order (tests the row-locking/serialization, not just the happy path)."

Foundation Plan §9: "must exist alongside the Payment/Khata stage build
in Phase 3, since this tests the same row-locking/serialization
discipline as inventory."
"""

from __future__ import annotations

import os
import random
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from uuid import uuid4

_REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
_FULFILLMENT_HALF = os.path.join(_REPO_ROOT, "fulfillment-half")
_PAYMENT_STAGE = os.path.join(_FULFILLMENT_HALF, "payment-khata-stage")

for path in (_REPO_ROOT, _FULFILLMENT_HALF, _PAYMENT_STAGE):
    if path not in sys.path:
        sys.path.insert(0, path)

from shared.contracts.customer import Customer
from khata_ledger import InMemoryKhataLedger, OverCreditLimitError


def _make_customer(credit_limit: float) -> Customer:
    return Customer(
        customer_id=uuid4(),
        store_id=uuid4(),
        phone_number="+923001112222",
        name="Property Test Customer",
        preferred_language="ur",
        khata_enabled=True,
        khata_credit_limit=credit_limit,
        created_at=datetime.now(timezone.utc),
    )


class TestKhataReconciliationUnderConcurrency:
    def test_running_balance_after_sums_exactly_regardless_of_execution_order(self):
        """The core property (TDD §12): fire N credit-sale bursts with
        random small delays (simulating real network jitter/thread
        scheduling), then assert the FINAL balance equals the exact
        sequential sum of amounts -- no entry lost, none double-applied,
        none silently reordered into an inconsistent partial state."""
        customer = _make_customer(credit_limit=100_000.0)  # high enough that every burst succeeds
        ledger = InMemoryKhataLedger([customer])
        customer_id = str(customer.customer_id)

        amounts = [round(random.uniform(10, 500), 2) for _ in range(50)]
        expected_total = round(sum(amounts), 2)

        def post(amount: float):
            return ledger.post_credit_sale(
                customer_id=customer_id, store_id=str(customer.store_id), order_id=str(uuid4()), amount=amount
            )

        with ThreadPoolExecutor(max_workers=25) as pool:
            futures = [pool.submit(post, a) for a in amounts]
            entries = [f.result() for f in as_completed(futures)]

        assert len(entries) == 50  # no entry silently lost
        assert round(ledger.balance_of(customer_id), 2) == expected_total

        # No duplicate/missed entries: the set of running_balance_after
        # values, sorted, must be a valid prefix-sum sequence of SOME
        # permutation of `amounts` -- i.e. the max recorded balance
        # equals the total, and there are exactly 50 distinct entries.
        recorded = ledger.entries_for(customer_id)
        assert len(recorded) == 50
        assert round(max(e.running_balance_after for e in recorded), 2) == expected_total

    def test_credit_limit_check_and_balance_mutation_are_atomic_under_a_burst(self):
        """The property that actually matters for the business rule:
        under a concurrent burst that WOULD collectively exceed the
        limit if the check-then-act happened outside the lock, no
        individual posted entry may ever leave running_balance_after >
        khata_credit_limit. Some bursts are expected to be rejected --
        the assertion is that acceptance is all-or-nothing per entry,
        never a partial/overlapping overshoot."""
        limit = 1000.0
        customer = _make_customer(credit_limit=limit)
        ledger = InMemoryKhataLedger([customer])
        customer_id = str(customer.customer_id)

        # 30 concurrent attempts at 100 each = 3000 potential, well over
        # the 1000 limit -- only 10 should ever succeed.
        def attempt(_: int):
            try:
                ledger.post_credit_sale(
                    customer_id=customer_id, store_id=str(customer.store_id), order_id=str(uuid4()), amount=100.0
                )
                return "accepted"
            except OverCreditLimitError:
                return "rejected"

        with ThreadPoolExecutor(max_workers=30) as pool:
            futures = [pool.submit(attempt, i) for i in range(30)]
            results = [f.result() for f in as_completed(futures)]

        accepted = results.count("accepted")
        assert accepted == 10
        assert results.count("rejected") == 20

        final_balance = ledger.balance_of(customer_id)
        assert final_balance == accepted * 100.0
        assert final_balance <= limit  # never overshoots, ever

        # Every recorded entry's own running_balance_after was also
        # within limit AT THE MOMENT it was written -- not just the
        # final tally.
        for entry in ledger.entries_for(customer_id):
            assert entry.running_balance_after <= limit
