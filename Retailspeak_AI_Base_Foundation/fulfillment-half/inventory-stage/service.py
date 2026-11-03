"""
TDD §2.8 (Inventory stage) — row-lock and reserve stock for each order
line; release on rollback. This module composes the single-row
transaction in store.py across a whole order's line_items, and is the
thing the orchestrator's `reserve_inventory` node (Plan §Phase 3) and
the `/internal/inventory/reserve` HTTP surface (api.py) both call.

Multi-line reservation is NOT itself one atomic transaction across rows
(TDD §9.2: locking is per-row, by design, so different products never
contend) -- so if line 3 of 4 fails, lines 1-2's reservations are
explicitly released before returning UNAVAILABLE, rather than left
half-committed. This is the same "each stage owns its own rollback path"
principle (Plan §Phase 3, TDD §1.1 diagram note) applied *within* a
single stage, not just across stages.
"""

from __future__ import annotations

from dataclasses import dataclass
from uuid import uuid4

from shared.idempotency.dedupe import IdempotencyGuard

from store import InsufficientStockError, InMemoryInventoryStore

STAGE_NAME = "inventory"


@dataclass
class ReservationRecord:
    """Server-side bookkeeping for a successful multi-line reservation,
    keyed by reservation_id -- exists so `release` (compensation) knows
    exactly which (product_id, quantity) pairs to reverse without the
    caller having to resend the original line items (TDD §4.6:
    `POST /internal/inventory/release {reservation_id}` -- reservation_id
    alone is the whole request body)."""

    reservation_id: str
    store_id: str
    lines: list[tuple[str, float]]  # (product_id, quantity)


class InventoryStage:
    def __init__(self, store: InMemoryInventoryStore, idempotency: IdempotencyGuard) -> None:
        self._store = store
        self._idempotency = idempotency
        self._reservations: dict[str, ReservationRecord] = {}

    def reserve(
        self, *, order_id: str, store_id: str, line_items: list[tuple[str, float]], idempotency_key: str
    ):
        """line_items: list of (product_id, quantity). Returns a dict
        matching ReserveInventoryResponse's shape (kept as a plain dict
        here so this module has no dependency on FastAPI/contracts --
        api.py does the Pydantic marshalling)."""

        def _do_reserve():
            committed: list[tuple[str, float]] = []
            try:
                for product_id, qty in line_items:
                    self._store.reserve(product_id, store_id, qty)
                    committed.append((product_id, qty))
            except InsufficientStockError as exc:
                # Roll back whatever DID reserve in this same call before
                # reporting UNAVAILABLE -- see module docstring.
                for product_id, qty in committed:
                    self._store.release(product_id, store_id, qty)
                return {
                    "reservation_id": None,
                    "lines": [],
                    "status": "unavailable",
                    "unavailable_lines": [str(exc)],
                }

            reservation_id = str(uuid4())
            self._reservations[reservation_id] = ReservationRecord(
                reservation_id=reservation_id, store_id=store_id, lines=list(line_items)
            )
            return {
                "reservation_id": reservation_id,
                "lines": [{"product_id": pid, "reserved_qty": qty} for pid, qty in line_items],
                "status": "reserved",
                "unavailable_lines": [],
            }

        return self._idempotency.run(idempotency_key, _do_reserve)

    def release(self, *, reservation_id: str, reason: str, idempotency_key: str):
        def _do_release():
            record = self._reservations.get(reservation_id)
            if record is None:
                # Already released (or never existed) -- release is
                # idempotent at this layer too, independent of the
                # IdempotencyGuard wrapper, since a compensating rollback
                # walk (TDD §5.4) may call release for a stage that never
                # actually committed on this particular retry path.
                return {"reservation_id": reservation_id, "status": "released"}
            for product_id, qty in record.lines:
                self._store.release(product_id, record.store_id, qty)
            del self._reservations[reservation_id]
            return {"reservation_id": reservation_id, "status": "released"}

        return self._idempotency.run(idempotency_key, _do_release)
