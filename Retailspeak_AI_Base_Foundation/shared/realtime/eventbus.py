"""
TDD §2.8 (Notification stage) / §4.6: "Redis pub/sub -> WebSocket
gateway" — and Execution Plan Prompt §4 Phase 4: dashboards must consume
"the real-time event pattern (Redis pub/sub -> WebSocket) rather than
polling."

This module is that seam, the same way `orchestrator/graph.py`'s
`PipelineGraph` stands in for real LangGraph and `checkpointer.py`'s
`InMemoryCheckpointer` stands in for the real Postgres checkpointer:
`EventBus.publish` / `.subscribe` is the interface every caller (the
Orchestrator, in this phase) and every client (the three dashboards'
WebSocket connections, via `realtime-gateway/api.py`) depends on.
`InMemoryEventBus` is the mock fan-out; swapping in real Redis pub/sub
touches only this file.

Channel scoping mirrors TDD §8.1 / Plan §1.3: every event is
`store_id`-scoped AND role-filtered at publish time, not filtered
client-side after delivery — a rider's channel never even receives an
owner-only event, the same way a rider's JWT is never issued owner
permissions. `Role.CUSTOMER` is deliberately never a publish target here:
customer-facing status updates go through the Notification stage's
SMS/WhatsApp/voice channels (already built, Phase 3), not this
dashboard-only bus — folding them in here would let a customer's socket
(if one ever existed) receive the same channel as staff, which Plan
§1.3's role-scoping forbids by construction.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Callable

from shared.auth.roles import Role
from shared.contracts.fulfillment import FulfillmentStage, OrderStatusEvent

DASHBOARD_ROLES = (Role.OWNER, Role.WAREHOUSE_STAFF, Role.RIDER)


@dataclass
class DashboardEvent:
    """One fan-out unit: an `OrderStatusEvent` (TDD §3.9's own shape,
    reused verbatim rather than forked — Plan §1.7's "one copy"
    principle) plus the routing info a real Redis channel name would
    encode (e.g. `store:{store_id}:role:owner`), plus whatever
    stage-specific payload the receiving dashboard needs to render the
    event without a follow-up REST call (pick_list_id, po_id, rider_id,
    ...)."""

    store_id: str
    roles: tuple[Role, ...]
    status_event: OrderStatusEvent
    extra: dict = field(default_factory=dict)
    # ROLE_PERMISSIONS (shared/auth/roles.py) forbids a rider from seeing
    # another rider's deliveries -- OWNER/WAREHOUSE_STAFF events are
    # store-wide broadcasts (there's exactly one active owner per store,
    # and warehouse_staff jointly work one shared pick queue, per TDD
    # §8.1), but RIDER events are scoped to exactly the rider this
    # delivery was assigned to. `recipient_id` carries that scoping when
    # `Role.RIDER` is one of `roles`; left `None` it means "broadcast to
    # every subscriber of that role in this store," which is only ever
    # correct for OWNER/WAREHOUSE_STAFF.
    recipient_id: str | None = None


Subscriber = Callable[[DashboardEvent], None]
Unsubscribe = Callable[[], None]


class EventBus(ABC):
    @abstractmethod
    def publish(self, event: DashboardEvent) -> None: ...

    @abstractmethod
    def subscribe(self, *, store_id: str, role: Role, callback: Subscriber, recipient_id: str | None = None) -> Unsubscribe:
        """Returns an unsubscribe callable, matching a real WebSocket
        connection's lifecycle (connect -> subscribe -> disconnect ->
        unsubscribe). A rider's socket MUST subscribe with its own
        `recipient_id` (its own rider_id) -- omitting it would (per
        `InMemoryEventBus`'s channel keying below) only match
        store-wide-broadcast events, which riders never receive, not
        every rider's events."""

    @abstractmethod
    def backfill(self, *, store_id: str, role: Role, recipient_id: str | None = None) -> list[DashboardEvent]:
        """A freshly-opened dashboard tab needs something to render
        before the first live event arrives. A real deployment would
        rely on each stage's own REST list endpoint for this (built
        alongside this module — see warehouse-stage's
        `/internal/warehouse/pick-lists`, supplier-stage's
        `/internal/supplier/pending-pos`, delivery-stage's
        `/internal/delivery/assignments/{rider_id}`); this in-memory
        backfill exists only so the demo clients and tests have
        something to show immediately after `subscribe()` without
        wiring every client to two different data sources."""


class InMemoryEventBus(EventBus):
    _BACKFILL_LIMIT = 20

    # channel key: (store_id, role, recipient_id | None). None is the
    # store-wide broadcast channel for that role; a specific recipient_id
    # is its own, separate channel -- publishing to one never leaks into
    # the other, which is what keeps a rider's socket from ever seeing
    # another rider's deliveries (see DashboardEvent.recipient_id).
    def __init__(self) -> None:
        self._subscribers: dict[tuple[str, Role, str | None], list[Subscriber]] = defaultdict(list)
        self._history: dict[tuple[str, Role, str | None], list[DashboardEvent]] = defaultdict(list)

    def publish(self, event: DashboardEvent) -> None:
        for role in event.roles:
            recipient = event.recipient_id if role == Role.RIDER else None
            channel = (event.store_id, role, recipient)
            history = self._history[channel]
            history.append(event)
            if len(history) > self._BACKFILL_LIMIT:
                del history[: len(history) - self._BACKFILL_LIMIT]
            for callback in list(self._subscribers[channel]):
                callback(event)

    def subscribe(self, *, store_id: str, role: Role, callback: Subscriber, recipient_id: str | None = None) -> Unsubscribe:
        channel = (store_id, role, recipient_id if role == Role.RIDER else None)
        self._subscribers[channel].append(callback)

        def unsubscribe() -> None:
            subs = self._subscribers[channel]
            if callback in subs:
                subs.remove(callback)

        return unsubscribe

    def backfill(self, *, store_id: str, role: Role, recipient_id: str | None = None) -> list[DashboardEvent]:
        channel = (store_id, role, recipient_id if role == Role.RIDER else None)
        return list(self._history[channel])


_default_bus = InMemoryEventBus()


def default_event_bus() -> InMemoryEventBus:
    """Module-level singleton, same pattern as
    `shared/idempotency/dedupe.py`'s default store — every service in
    this process shares one bus instance unless a test constructs its
    own `InMemoryEventBus()` for isolation."""
    return _default_bus


def make_event(
    *,
    order_id: str,
    stage: FulfillmentStage,
    store_id: str,
    roles: tuple[Role, ...],
    actor: str,
    detail: str | None = None,
    extra: dict | None = None,
    recipient_id: str | None = None,
) -> DashboardEvent:
    """Small builder so `nodes.py` doesn't hand-construct
    `OrderStatusEvent` at every call site — keeps `occurred_at` handling
    in one place. Pass `recipient_id` (the rider_id) whenever `roles`
    includes `Role.RIDER` and the event is about one specific rider's
    delivery, not a store-wide broadcast."""
    return DashboardEvent(
        store_id=store_id,
        roles=roles,
        status_event=OrderStatusEvent(
            order_id=order_id, stage=stage, occurred_at=datetime.now(timezone.utc), detail=detail, actor=actor
        ),
        extra=extra or {},
        recipient_id=recipient_id,
    )
