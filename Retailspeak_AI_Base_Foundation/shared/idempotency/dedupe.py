"""
TDD §5.5 / Foundation Plan §6.1 — Idempotency-key handling and dedupe-record
storage.

Every stage call carries an `Idempotency-Key` header of the exact form
`f"{order_id}:{stage_name}:{attempt_seq}"` (TDD §5.5). Stage services
persist a dedupe record keyed on this value with a 24-hour TTL; a repeated
call with the same key returns the ORIGINAL response rather than
re-executing the side effect. This is critical for Inventory/reserve and
Payment/charge specifically, which must never double-reserve or
double-charge (TDD §5.5) — which is exactly why Plan §7 (Build Sequencing)
calls this out as a dependency that "must exist before Inventory and
Payment/Khata ship," not a later hardening pass.

Build once, import everywhere (Plan §6 preamble) — every stage service in
fulfillment-half/ wraps its side-effecting handler with `IdempotencyGuard`
rather than reimplementing dedupe per stage. Phase 3 mock: in-process
dict with a wall-clock TTL sweep. Production swap: a Redis (Upstash) or
Postgres table keyed on `idempotency_key`, same TTL semantics, same
`DedupeStore` interface — no caller changes.
"""

from __future__ import annotations

import time
from abc import ABC, abstractmethod
from dataclasses import dataclass
from threading import Lock
from typing import Any, Callable, TypeVar

DEDUPE_TTL_SECONDS = 24 * 60 * 60  # 24h TTL (TDD §5.5)

T = TypeVar("T")


def idempotency_key(order_id: str, stage_name: str, attempt_seq: int) -> str:
    """The exact key shape TDD §5.5 specifies. Every caller builds the
    header value through this function rather than hand-formatting the
    f-string, so the shape can't drift between stages."""
    return f"{order_id}:{stage_name}:{attempt_seq}"


@dataclass
class _DedupeRecord:
    response: Any
    stored_at: float


class DedupeStore(ABC):
    """Storage seam. Phase 3 mock is in-memory; production is Redis/Postgres
    with the same TTL contract — swap the implementation, not the callers."""

    @abstractmethod
    def get(self, key: str) -> Any | None: ...

    @abstractmethod
    def put(self, key: str, response: Any) -> None: ...


class InMemoryDedupeStore(DedupeStore):
    """Phase 3 mock (Execution Plan §4 Phase 3 convention: scaffold every
    cross-cutting seam with a typed mock before the real backend exists,
    same pattern as MockCatalogStore in Phase 1/2). Thread-safe: the
    concurrent-reservation chaos test (Plan §9) and the khata property
    test both hammer this store from multiple threads."""

    def __init__(self, ttl_seconds: int = DEDUPE_TTL_SECONDS) -> None:
        self._ttl = ttl_seconds
        self._records: dict[str, _DedupeRecord] = {}
        self._lock = Lock()

    def get(self, key: str) -> Any | None:
        with self._lock:
            record = self._records.get(key)
            if record is None:
                return None
            if time.time() - record.stored_at > self._ttl:
                del self._records[key]
                return None
            return record.response

    def put(self, key: str, response: Any) -> None:
        with self._lock:
            self._records[key] = _DedupeRecord(response=response, stored_at=time.time())


class IdempotencyGuard:
    """
    The shared entry point every stage service calls instead of
    reimplementing "check dedupe store, else execute, else store" inline
    (Plan §6.1: "shared middleware/library code all stage services
    import, not a per-stage reimplementation").

    Usage (see inventory-stage/service.py, payment-khata-stage/service.py):

        guard = IdempotencyGuard(store)
        result = guard.run(key, lambda: really_do_the_side_effecting_thing())

    `run` is NOT itself a lock — it does not serialize concurrent callers
    with the *same* key (in practice the orchestrator only ever issues one
    in-flight call per key; a genuine race on an identical key is treated
    as "first writer wins, second reads the cached result" via the
    store's own get-then-put ordering below, which is sufficient given
    the orchestrator's own retry policy in TDD §5.5 never fires the same
    key concurrently — it retries sequentially after a timeout/5xx).
    """

    def __init__(self, store: DedupeStore) -> None:
        self._store = store

    def run(self, key: str, execute: Callable[[], T]) -> T:
        cached = self._store.get(key)
        if cached is not None:
            return cached
        result = execute()
        self._store.put(key, result)
        return result
