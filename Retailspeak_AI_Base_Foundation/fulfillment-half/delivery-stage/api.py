"""TDD §4.6 — `POST /internal/delivery/assign`. Orchestrator-only."""

from __future__ import annotations

import os
import sys

_HERE = os.path.dirname(os.path.abspath(__file__))
_FULFILLMENT_HALF = os.path.dirname(_HERE)
_REPO_ROOT = os.path.dirname(_FULFILLMENT_HALF)
_RAG_SERVICE = os.path.join(_REPO_ROOT, "nlu-half", "rag-retrieval-service")
sys.path.insert(0, _REPO_ROOT)
sys.path.insert(0, _FULFILLMENT_HALF)
sys.path.insert(0, _RAG_SERVICE)
sys.path.insert(0, _HERE)

from fastapi import FastAPI

from _rider_fixtures import fixture_riders
from contracts.pipeline_io import DeliveryAssignRequest, DeliveryAssignResponse
from matcher import RiderMatcher
from mock_catalog import DEFAULT_STORE_ID
from service import DeliveryStage

app = FastAPI(title="delivery-stage")
_stage = DeliveryStage(RiderMatcher(fixture_riders(DEFAULT_STORE_ID)))


@app.post("/internal/delivery/assign", response_model=DeliveryAssignResponse)
def assign(request: DeliveryAssignRequest) -> DeliveryAssignResponse:
    result = _stage.assign(
        order_id=request.order_id,
        store_id=request.store_id,
        delivery_address=request.delivery_address,
        delivery_lat=request.delivery_lat,
        delivery_lng=request.delivery_lng,
    )
    return DeliveryAssignResponse(**result)


@app.get("/internal/delivery/assignments/{rider_id}")
def list_assignments(rider_id: str) -> list[dict]:
    """Phase 4 — Rider client's "my deliveries" list (see `service.py`'s
    `list_for_rider` docstring). Path-scoped by `rider_id` rather than a
    query param specifically so the endpoint shape itself can't return
    another rider's rows by omission -- in production this still needs
    the transport-layer check that the caller's own JWT `subject_id`
    matches `rider_id` (TDD §8.2's pattern, same as
    warehouse-stage/api.py's actor check), not implemented here since
    this scaffold's stage endpoints don't decode real JWTs yet."""
    return _stage.list_for_rider(rider_id)
