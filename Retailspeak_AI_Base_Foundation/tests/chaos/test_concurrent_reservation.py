"""
Foundation Plan §9 — "The concurrent-reservation chaos test (asserting
reservations never exceed on_hand_qty and no reservation is silently
lost) must exist alongside the Inventory stage build in Phase 3 (TDD
§12) -- this directly tests the row-locking pattern from §4.3, and
shipping Inventory without it risks the exact overselling bug that
pattern exists to prevent."

TDD §12's own framing: "Concurrent reservation attempts against a
single low-stock SKU, asserting reservations never exceed on_hand_qty
and no reservation is silently lost."
"""

from __future__ import annotations

import os
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed

_REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
_NLU_HALF = os.path.join(_REPO_ROOT, "nlu-half")
_RAG_SERVICE = os.path.join(_NLU_HALF, "rag-retrieval-service")
_FULFILLMENT_HALF = os.path.join(_REPO_ROOT, "fulfillment-half")
_INVENTORY_STAGE = os.path.join(_FULFILLMENT_HALF, "inventory-stage")

for path in (_REPO_ROOT, _RAG_SERVICE, _FULFILLMENT_HALF, _INVENTORY_STAGE):
    if path not in sys.path:
        sys.path.insert(0, path)

from mock_catalog import MockCatalogStore
from shared.idempotency.dedupe import IdempotencyGuard, InMemoryDedupeStore
from store import InsufficientStockError, InMemoryInventoryStore

_catalog = MockCatalogStore()
# "Sunflower Oil 1L": in_stock_qty=5.0 (mock_catalog.py's own low-stock
# fixture) -- deliberately scarce, so N concurrent requests for 1 unit
# each will force some to fail once the 5 units are exhausted, which is
# the exact contention the row lock exists to serialize correctly.
_LOW_STOCK_PRODUCT = next(p for p in _catalog._products if p.name_en == "Sunflower Oil 1L")


def _fresh_store() -> InMemoryInventoryStore:
    return InMemoryInventoryStore(_catalog._products)


class TestConcurrentReservationNeverOversells:
    def test_20_concurrent_1_unit_requests_against_5_units_of_stock(self):
        store = _fresh_store()
        product_id = str(_LOW_STOCK_PRODUCT.product_id)
        store_id = str(_LOW_STOCK_PRODUCT.store_id)
        on_hand = _LOW_STOCK_PRODUCT.in_stock_qty  # 5.0

        successes = []
        failures = []

        def attempt_reserve(_: int):
            try:
                store.reserve(product_id, store_id, 1.0)
                return "ok"
            except InsufficientStockError:
                return "insufficient"

        with ThreadPoolExecutor(max_workers=20) as pool:
            futures = [pool.submit(attempt_reserve, i) for i in range(20)]
            for f in as_completed(futures):
                (successes if f.result() == "ok" else failures).append(f.result())

        # Never oversells: exactly on_hand successes, the rest cleanly rejected.
        assert len(successes) == int(on_hand)
        assert len(failures) == 20 - int(on_hand)

        # No reservation silently lost: the row's reserved_qty reflects
        # exactly the successful count, not more (double-counted) or
        # less (dropped under contention).
        record = store.get(product_id, store_id)
        assert record.reserved_qty == int(on_hand)
        assert record.available_qty == 0

    def test_reserve_then_concurrent_release_returns_to_exact_starting_state(self):
        """Reservations must be exactly reversible under concurrency
        too -- release is the compensating call (TDD §4.6) and has to be
        just as race-free as reserve."""
        store = _fresh_store()
        product_id = str(_LOW_STOCK_PRODUCT.product_id)
        store_id = str(_LOW_STOCK_PRODUCT.store_id)

        for _ in range(5):
            store.reserve(product_id, store_id, 1.0)
        assert store.get(product_id, store_id).reserved_qty == 5.0

        with ThreadPoolExecutor(max_workers=5) as pool:
            futures = [pool.submit(store.release, product_id, store_id, 1.0) for _ in range(5)]
            for f in as_completed(futures):
                f.result()

        record = store.get(product_id, store_id)
        assert record.reserved_qty == 0.0
        assert record.available_qty == record.on_hand_qty

    def test_concurrent_reservations_on_different_products_never_contend(self):
        """TDD §9.2: row-locking is per (product_id, store_id), not
        table-level -- concurrent reservations on DIFFERENT products
        must all succeed independently, proving the lock granularity is
        actually per-row and not accidentally serializing everything."""
        store = _fresh_store()
        # Basmati Rice (120 in stock) and Eggs (400 in stock) -- both
        # comfortably above what 10 concurrent 1-unit requests each need.
        rice = next(p for p in _catalog._products if p.name_en == "Basmati Rice")
        eggs = next(p for p in _catalog._products if p.name_en == "Eggs")

        def reserve_rice(_):
            store.reserve(str(rice.product_id), str(rice.store_id), 1.0)

        def reserve_eggs(_):
            store.reserve(str(eggs.product_id), str(eggs.store_id), 1.0)

        with ThreadPoolExecutor(max_workers=20) as pool:
            futures = [pool.submit(reserve_rice, i) for i in range(10)]
            futures += [pool.submit(reserve_eggs, i) for i in range(10)]
            for f in as_completed(futures):
                f.result()  # raises if any unexpectedly failed

        assert store.get(str(rice.product_id), str(rice.store_id)).reserved_qty == 10.0
        assert store.get(str(eggs.product_id), str(eggs.store_id)).reserved_qty == 10.0

    def test_idempotency_guard_prevents_double_reservation_on_retried_key(self):
        """TDD §5.5: a repeated call with the same Idempotency-Key
        returns the original response rather than re-executing the side
        effect -- critical for inventory-reserve specifically."""
        # Loaded via importlib with an explicit alias, not a bare
        # `from service import InventoryStage` -- every fulfillment-half
        # stage directory has its own same-named `service.py`
        # (wiring.py's own docstring notes this), so a bare import here
        # resolves to whichever `service` module some OTHER test
        # happened to import first into `sys.modules` this session (test
        # execution order dependent, not this file's own doing). This
        # mirrors wiring.py's `_load()` helper for the same reason.
        import importlib.util

        _spec = importlib.util.spec_from_file_location(
            "_inventory_stage_service_chaos_test", os.path.join(_INVENTORY_STAGE, "service.py")
        )
        _inventory_service_module = importlib.util.module_from_spec(_spec)
        sys.modules[_spec.name] = _inventory_service_module  # dataclasses in service.py resolve their own
        _spec.loader.exec_module(_inventory_service_module)  # module via sys.modules[cls.__module__]
        InventoryStage = _inventory_service_module.InventoryStage

        store = _fresh_store()
        stage = InventoryStage(store=store, idempotency=IdempotencyGuard(InMemoryDedupeStore()))
        product_id = str(_LOW_STOCK_PRODUCT.product_id)
        store_id = str(_LOW_STOCK_PRODUCT.store_id)

        key = "order-x:inventory:1"
        first = stage.reserve(order_id="order-x", store_id=store_id, line_items=[(product_id, 2.0)], idempotency_key=key)
        second = stage.reserve(order_id="order-x", store_id=store_id, line_items=[(product_id, 2.0)], idempotency_key=key)

        assert first == second
        # Only ONE reservation actually landed -- 2.0, not 4.0.
        assert store.get(product_id, store_id).reserved_qty == 2.0
