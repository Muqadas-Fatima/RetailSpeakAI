"""
TDD §7.2 / Foundation Plan §4.3 — the row-locking reservation transaction,
established at the DB-access layer, not retrofitted:

    BEGIN;
    SELECT on_hand_qty, reserved_qty, version
      FROM inventory_records
      WHERE product_id = $1 AND store_id = $2
      FOR UPDATE;
    -- application checks on_hand_qty - reserved_qty >= requested_qty
    UPDATE inventory_records
      SET reserved_qty = reserved_qty + $3, version = version + 1
      WHERE product_id = $1 AND store_id = $2;
    COMMIT;

`InventoryRecord.available_qty` is NEVER trusted as a cached pre-read for
a reserve decision (Plan §4.3) — the check happens inside the locked
section below. Row-locking is per `(product_id, store_id)` row, not
table-level (TDD §9.2), so concurrent reservations on *different*
products never contend; this is why the lock table below is keyed on
that tuple rather than a single global lock.

Phase 3 mock: an in-process `threading.Lock` per row stands in for
Postgres's `SELECT ... FOR UPDATE` row lock — same serialization
guarantee (a second concurrent caller for the same row blocks until the
first releases the lock, then re-evaluates against the now-updated
`reserved_qty`), same interface (`reserve`/`release`/`get`) a real
`psycopg`-backed implementation would expose, so swapping this for
Postgres later doesn't change any caller (`service.py`, the chaos test
in tests/chaos/) at all.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from threading import Lock

from shared.contracts.catalog import Product
from shared.contracts.inventory import InventoryRecord


class InsufficientStockError(Exception):
    """Raised inside the locked section when on_hand_qty - reserved_qty <
    requested_qty. The caller (service.py) turns this into a
    ReservationStatus.UNAVAILABLE response — it is a business-logic
    failure (TDD §5.5), not a transient one, so the orchestrator's retry
    policy must NOT retry it."""


@dataclass
class _Row:
    on_hand_qty: float
    reserved_qty: float
    version: int
    lock: Lock = field(default_factory=Lock)


class InMemoryInventoryStore:
    """
    Phase 3 mock for the `inventory_records` table (TDD §9.1). Locks for
    every known `(product_id, store_id)` row are created up front at
    construction time (from the seed catalog), specifically so `reserve`
    and `release` never need a second, row-creation lock around "does
    this row's lock already exist" — that would reintroduce exactly the
    kind of contention point the per-row design is meant to avoid.
    """

    def __init__(self, products: list[Product]) -> None:
        self._rows: dict[tuple[str, str], _Row] = {}
        for p in products:
            key = (str(p.product_id), str(p.store_id))
            self._rows[key] = _Row(on_hand_qty=p.in_stock_qty, reserved_qty=0.0, version=0)

    def get(self, product_id: str, store_id: str) -> InventoryRecord:
        row = self._row(product_id, store_id)
        with row.lock:
            return self._to_record(product_id, store_id, row)

    def reserve(self, product_id: str, store_id: str, quantity: float) -> InventoryRecord:
        """The transaction above, in full: acquire the row lock (`FOR
        UPDATE` equivalent), check available capacity, mutate, release.
        Raises InsufficientStockError while still holding nothing further
        (the lock is released via the `with` block regardless of outcome)."""
        row = self._row(product_id, store_id)
        with row.lock:
            available = row.on_hand_qty - row.reserved_qty
            if available < quantity:
                raise InsufficientStockError(
                    f"product {product_id} store {store_id}: requested {quantity}, "
                    f"available {available}"
                )
            row.reserved_qty += quantity
            row.version += 1
            return self._to_record(product_id, store_id, row)

    def release(self, product_id: str, store_id: str, quantity: float) -> InventoryRecord:
        """Compensating call (TDD §4.6 rollback column) — always
        succeeds; releasing is not subject to the availability check
        reserve is. Clamped at 0 so a duplicate release (e.g. an
        idempotency-key replay that somehow reached the store layer
        directly, bypassing the guard in service.py) can't drive
        reserved_qty negative."""
        row = self._row(product_id, store_id)
        with row.lock:
            row.reserved_qty = max(0.0, row.reserved_qty - quantity)
            row.version += 1
            return self._to_record(product_id, store_id, row)

    def _row(self, product_id: str, store_id: str) -> _Row:
        key = (product_id, store_id)
        if key not in self._rows:
            raise KeyError(f"no inventory_records row for product {product_id} store {store_id}")
        return self._rows[key]

    @staticmethod
    def _to_record(product_id: str, store_id: str, row: _Row) -> InventoryRecord:
        from datetime import datetime, timezone
        from uuid import UUID

        return InventoryRecord(
            product_id=UUID(product_id),
            store_id=UUID(store_id),
            on_hand_qty=row.on_hand_qty,
            reserved_qty=row.reserved_qty,
            available_qty=row.on_hand_qty - row.reserved_qty,
            last_counted_at=datetime.now(timezone.utc),
            version=row.version,
        )
