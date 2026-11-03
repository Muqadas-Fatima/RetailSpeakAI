"""
TDD §3.8 — Rider.

gps_reliable flips false after 3 missed pings in 5 minutes (Plan
§Phase 3 step 7) and hands control to the rider's manual
arrived/delivered button — build that fallback control now, since
this field exists precisely to drive it.

Per Plan §6 (Open Decisions): this is the current model as-is — no
shift/payout fields, no decline path on assignment (assignment
response is treated as final). Riders are the shopkeeper's own
employed staff, not gig/outsourced.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from uuid import UUID

from pydantic import BaseModel


class RiderStatus(str, Enum):
    AVAILABLE = "available"
    ON_DELIVERY = "on_delivery"
    OFFLINE = "offline"


class Rider(BaseModel):
    rider_id: UUID
    store_id: UUID
    name: str
    phone_number: str
    status: RiderStatus
    current_lat: float | None = None
    current_lng: float | None = None
    last_location_update: datetime | None = None
    gps_reliable: bool = True  # false triggers manual status fallback
