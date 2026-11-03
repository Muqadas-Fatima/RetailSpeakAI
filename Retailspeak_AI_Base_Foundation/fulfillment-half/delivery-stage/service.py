"""
TDD §5.2 (`ready` -> rider match runs -> `assigned_to_rider` / stays
`ready`, retried) and §11 (`Rider.gps_reliable` fallback).

No-rider-available handling: per TDD §4.6's rollback column, this is
explicitly NOT a failure -- the order is held in `ready`, retried on a
timer, and the Owner is alerted after 15 minutes
(`StoreConfig.rider_no_match_alert_minutes`, shared/config/store_config.py).
This service returns `held=True` rather than raising; the orchestrator
node (nodes.py) is what actually schedules the retry-on-timer, since
that's a graph-level concern (Plan §Phase 3), not this stage's own.
"""

from __future__ import annotations

from shared.contracts.rider import RiderStatus
from shared.config.store_config import StoreConfig

from matcher import RiderMatcher

STAGE_NAME = "delivery"


class DeliveryStage:
    def __init__(self, matcher: RiderMatcher) -> None:
        self._matcher = matcher
        # Phase 4: the rider client's "my assigned deliveries" list needs
        # somewhere to read from besides the orchestrator's per-order
        # state (which the Rider App has no reason to poll every order
        # for) -- keyed by rider_id, mirroring how warehouse-stage keys
        # its pick lists by order_id for its own dashboard's query.
        self._assignments: dict[str, list[dict]] = {}

    def assign(
        self, *, order_id: str, store_id: str, delivery_address: str = "", delivery_lat: float | None, delivery_lng: float | None
    ):
        result = self._matcher.match(store_id=store_id, delivery_lat=delivery_lat, delivery_lng=delivery_lng)
        if result.rider is None:
            return {"rider_id": None, "route_id": None, "eta": None, "held": True}
        rider_id = str(result.rider.rider_id)
        self._assignments.setdefault(rider_id, []).append(
            {
                "order_id": order_id,
                "route_id": result.route_id,
                "eta": result.eta,
                "delivery_address": delivery_address,
                "delivery_lat": delivery_lat,
                "delivery_lng": delivery_lng,
                "status": "assigned",
            }
        )
        return {
            "rider_id": rider_id,
            "route_id": result.route_id,
            "eta": result.eta,
            "held": False,
        }

    def list_for_rider(self, rider_id: str) -> list[dict]:
        """Phase 4 (§2.9-adjacent Rider mobile client, TDD §2.8's
        Delivery/Rider row) — backs
        `GET /internal/delivery/assignments/{rider_id}`. Deliberately
        keyed and filtered by `rider_id` only, never returning another
        rider's rows, matching `ROLE_PERMISSIONS[Role.RIDER]["cannot"]`
        (`shared/auth/roles.py`): a rider may never see another rider's
        deliveries."""
        return list(self._assignments.get(rider_id, []))

    def mark_status(self, *, rider_id: str, order_id: str, status: str) -> None:
        """Keeps this stage's own copy of assignment status in sync with
        the orchestrator's `current_stage` (out_for_delivery / delivered)
        so `list_for_rider` reflects it without the Rider App having to
        cross-reference the orchestrator's per-order endpoint for every
        row in its own list."""
        for row in self._assignments.get(rider_id, []):
            if row["order_id"] == order_id:
                row["status"] = status
                return

    def mark_out_for_delivery(self, *, rider_id: str) -> None:
        """Rider starts route (TDD §5.2). Status is already ON_DELIVERY
        from `assign` -- this transition is tracked at the order/graph
        level (`FulfillmentStage.OUT_FOR_DELIVERY`, orchestrator/state.py),
        not as a further Rider-status mutation, since a rider stays
        ON_DELIVERY for the whole leg regardless of the order's own
        out_for_delivery vs. delivered split."""

    def mark_delivered_or_exception(self, *, rider: object, delivered: bool) -> None:
        """Frees the rider back to AVAILABLE on a successful delivery;
        leaves them ON_DELIVERY on a delivery_exception (TDD §5.2: a
        delivery_exception is Owner-resolved, not auto-retried with the
        same rider mid-exception)."""
        if delivered:
            rider.status = RiderStatus.AVAILABLE  # type: ignore[attr-defined]
