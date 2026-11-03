"""
TDD §2.8 (Delivery/Rider stage) — match a ready order to an available
Rider, batch nearby orders, track status.

Phase 3 scope note: real nearest-rider matching uses PostGIS
`ST_Distance` over `Rider.current_location` (TDD §9.1) against the
delivery address. This mock uses plain Euclidean distance over raw
lat/lng floats -- close enough to demonstrate "pick the nearest
AVAILABLE rider" without a PostGIS dependency; swapping in a real
geo-index query changes only `_nearest_available`'s body, not
`RiderMatcher`'s interface.

Order-batching ("batch nearby orders," TDD §2.8) is explicitly NOT
implemented here -- it's a routing-optimization feature layered on top
of single-order assignment, and nothing in the TDD's §5 state machine or
§4.6 endpoint contracts requires it to exist for v1's `assign` to work
correctly. Noted as a gap rather than half-built (Plan §10's own
pattern for scoping decisions).
"""

from __future__ import annotations

import math
from dataclasses import dataclass

from shared.contracts.rider import Rider, RiderStatus


@dataclass
class MatchResult:
    rider: Rider | None
    route_id: str | None
    eta: str | None


class RiderMatcher:
    def __init__(self, riders: list[Rider]) -> None:
        self._riders = riders

    def match(self, *, store_id: str, delivery_lat: float | None, delivery_lng: float | None) -> MatchResult:
        candidates = [
            r for r in self._riders if str(r.store_id) == store_id and r.status == RiderStatus.AVAILABLE
        ]
        if not candidates:
            return MatchResult(rider=None, route_id=None, eta=None)

        if delivery_lat is None or delivery_lng is None:
            chosen = candidates[0]
        else:
            chosen = min(candidates, key=lambda r: self._distance(r, delivery_lat, delivery_lng))

        chosen.status = RiderStatus.ON_DELIVERY
        return MatchResult(rider=chosen, route_id=f"route_{chosen.rider_id}", eta="20 min")

    @staticmethod
    def _distance(rider: Rider, lat: float, lng: float) -> float:
        if rider.current_lat is None or rider.current_lng is None:
            return math.inf
        return math.hypot(rider.current_lat - lat, rider.current_lng - lng)
