"""
TDD §2.8 (Warehouse stage) / §2.9 (Warehouse Staff App) / §4.6
(`POST /internal/warehouse/pick`).

System generates a pick list from reserved order lines; Warehouse Staff
work the list in the Warehouse Staff App, marking the order "ready" or
flagging a pick discrepancy. This is one of the two stage endpoints
invoked by a HUMAN actor (TDD §4.6) rather than the orchestrator
directly -- `actor` carries `warehouse_staff:{id}` and the caller
(api.py) is expected to have already checked the acting user's role JWT
(`shared.auth.roles.require_role`) before this service method runs; this
module additionally records the actor string on the pick list itself so
the audit trail doesn't rely solely on the auth layer's own logs.

Discrepancy handling (TDD §5.2 transition table, "on pick discrepancy:
flag delivery_exception, keep payment, Owner resolves manually, does not
auto-refund") -- this stage does NOT roll back payment or release
inventory on a discrepancy; it hands the order to `exception` status and
stops, by design.
"""

from __future__ import annotations

from dataclasses import dataclass
from uuid import uuid4

STAGE_NAME = "warehouse"


@dataclass
class PickList:
    pick_list_id: str
    order_id: str
    reservation_id: str
    status: str = "picking"  # "picking" | "ready" | "exception"
    picked_by: str | None = None
    discrepancy_note: str | None = None


class WarehouseStage:
    def __init__(self) -> None:
        self._pick_lists: dict[str, PickList] = {}

    def generate_pick_list(self, *, order_id: str, reservation_id: str) -> PickList:
        """Called by the orchestrator node when the order transitions
        into `picking` (TDD §5.1) -- exists as a separate step from
        `mark_picked` because, per TDD §2.9, the pick list must exist
        BEFORE Warehouse Staff can act on it (the App displays
        pick-list-ready events)."""
        pick_list = PickList(pick_list_id=str(uuid4()), order_id=order_id, reservation_id=reservation_id)
        self._pick_lists[order_id] = pick_list
        return pick_list

    def mark_picked(
        self, *, order_id: str, reservation_id: str, actor: str, discrepancy: bool, discrepancy_note: str | None
    ) -> PickList:
        pick_list = self._pick_lists.get(order_id)
        if pick_list is None:
            # Defense in depth (Plan §1.3: every stage boundary
            # re-validates): a pick action for an order with no
            # generated pick list is rejected outright rather than
            # silently creating one on the fly.
            raise ValueError(f"no pick list generated for order {order_id}")

        pick_list.picked_by = actor
        if discrepancy:
            pick_list.status = "exception"
            pick_list.discrepancy_note = discrepancy_note
        else:
            pick_list.status = "ready"
        return pick_list

    def list_pick_lists(self, *, status: str | None = None) -> list[PickList]:
        """Phase 4 (§2.9 Warehouse Staff App) — backs
        `GET /internal/warehouse/pick-lists`, the App's initial-load
        query behind its live WebSocket feed (TDD §2.8's Notification
        stage covers the push half; this covers "what does the queue
        look like right now"). `status=None` (default) returns
        everything; the App itself calls this with `status="picking"`
        for its main actionable queue, an Owner reviewing exceptions
        calls it with `status="exception"` instead."""
        lists = list(self._pick_lists.values())
        if status is None:
            return lists
        return [pl for pl in lists if pl.status == status]
