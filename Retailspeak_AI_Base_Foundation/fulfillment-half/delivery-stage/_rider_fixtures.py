"""Phase 3 dev fixture riders (TDD §3.8) -- same convention as
payment-khata-stage/_customer_fixtures.py. Two AVAILABLE riders at different
coordinates so `RiderMatcher`'s nearest-distance selection has something
to differentiate, plus one OFFLINE rider so the "no eligible candidate"
filter (matcher.py) has a non-match to exclude.
"""

from __future__ import annotations

from uuid import UUID

from shared.contracts.rider import Rider, RiderStatus


def fixture_riders(store_id: UUID) -> list[Rider]:
    return [
        Rider(
            rider_id=UUID("00000000-0000-0000-0000-000000000101"),
            store_id=store_id,
            name="Rider Ali",
            phone_number="+923001112222",
            status=RiderStatus.AVAILABLE,
            current_lat=24.8607,
            current_lng=67.0011,
            gps_reliable=True,
        ),
        Rider(
            rider_id=UUID("00000000-0000-0000-0000-000000000102"),
            store_id=store_id,
            name="Rider Bilal",
            phone_number="+923003334444",
            status=RiderStatus.AVAILABLE,
            current_lat=24.8700,
            current_lng=67.0300,
            gps_reliable=True,
        ),
        Rider(
            rider_id=UUID("00000000-0000-0000-0000-000000000103"),
            store_id=store_id,
            name="Rider Sana (offline)",
            phone_number="+923005556666",
            status=RiderStatus.OFFLINE,
            gps_reliable=True,
        ),
    ]
