"""
Phase 3 dev fixture (Execution Plan §4 Phase 3 convention: scaffold every
seam with a typed mock before the real backend exists). Mirrors
nlu-half/rag-retrieval-service/mock_catalog.py's role for the catalog,
but for `customers` (TDD §9.1) -- not folded into that module since
mock_catalog.py is explicitly nlu-half-scoped plumbing (Plan §1.7's
"one copy" caveat applies to the ten shared/contracts models, not to
every fixture in the repo).

One khata-enabled customer with a real credit limit low enough to be
crossed by a normal-sized order, specifically so the over-limit path
(TDD §5.3, §12) has a fixture to demonstrate against, same spirit as
mock_catalog.py's already-low-stock "Sunflower Oil 1L" row.
"""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from shared.contracts.customer import Customer

DEFAULT_CUSTOMER_ID = UUID("00000000-0000-0000-0000-0000000000c1")
LOW_LIMIT_CUSTOMER_ID = UUID("00000000-0000-0000-0000-0000000000c2")


def fixture_customers() -> list[Customer]:
    # Reuses the same store_id as the catalog fixture (mock_catalog.py's
    # DEFAULT_STORE_ID, already on sys.path via api.py) rather than
    # inventing a second one, so a Phase 3 integration test can drive
    # one consistent store_id through catalog, inventory, and khata.
    from mock_catalog import DEFAULT_STORE_ID

    return [
        Customer(
            customer_id=DEFAULT_CUSTOMER_ID,
            store_id=DEFAULT_STORE_ID,
            phone_number="+923001234567",
            name="Regular Khata Customer",
            preferred_language="ur",
            khata_enabled=True,
            khata_credit_limit=5000.0,
            created_at=datetime.now(timezone.utc),
        ),
        Customer(
            customer_id=LOW_LIMIT_CUSTOMER_ID,
            store_id=DEFAULT_STORE_ID,
            phone_number="+923007654321",
            name="Near-Limit Khata Customer",
            preferred_language="roman_ur",
            khata_enabled=True,
            khata_credit_limit=100.0,  # deliberately low -- exercises the over-limit path
            created_at=datetime.now(timezone.utc),
        ),
    ]
