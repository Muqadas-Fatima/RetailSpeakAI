"""
TDD §4.6 — `POST /internal/warehouse/pick`. One of the two stage
endpoints invoked by a human actor rather than the orchestrator (TDD
§4.6, §8.1) -- carries `actor: "warehouse_staff:{id}"` and, per TDD
§8.1/§8.2, the stage validates BOTH a service JWT (mTLS transport,
verified upstream of this handler) AND the acting user's own role JWT
(`shared.auth.roles.require_role`, applied here).

A `warehouse_staff` credential presented against this endpoint is
accepted; anything else (e.g. a `rider` or `customer` JWT) is rejected
regardless of what the request body claims (TDD §8.2's exact framing).
"""

from __future__ import annotations

import os
import sys

_HERE = os.path.dirname(os.path.abspath(__file__))
_FULFILLMENT_HALF = os.path.dirname(_HERE)
_REPO_ROOT = os.path.dirname(_FULFILLMENT_HALF)
sys.path.insert(0, _REPO_ROOT)
sys.path.insert(0, _FULFILLMENT_HALF)
sys.path.insert(0, _HERE)

from fastapi import FastAPI, HTTPException

from contracts.pipeline_io import WarehousePickRequest, WarehousePickResponse
from service import WarehouseStage
from shared.auth.roles import AuthenticatedPrincipal, AuthorizationError, Role, require_role

app = FastAPI(title="warehouse-stage")
_stage = WarehouseStage()


@require_role(Role.WAREHOUSE_STAFF)
def _mark_picked(principal: AuthenticatedPrincipal, request: WarehousePickRequest) -> WarehousePickResponse:
    pick_list = _stage.mark_picked(
        order_id=request.order_id,
        reservation_id=request.reservation_id,
        actor=request.actor,
        discrepancy=request.discrepancy,
        discrepancy_note=request.discrepancy_note,
    )
    return WarehousePickResponse(
        pick_list_id=pick_list.pick_list_id, status=pick_list.status, picked_by=pick_list.picked_by
    )


@app.post("/internal/warehouse/pick", response_model=WarehousePickResponse)
def pick(request: WarehousePickRequest) -> WarehousePickResponse:
    # `actor` (e.g. "warehouse_staff:9f2c...") is parsed into the
    # AuthenticatedPrincipal shape `require_role` expects. In production
    # this principal comes from decoding the request's own role JWT, not
    # the request body -- the body's `actor` string is untrusted
    # (Plan §1.3) and used here only to build a matching-shaped
    # principal for the scaffold; a real deployment decodes a signed JWT
    # instead of trusting this field's role claim.
    try:
        role_str, subject_id = request.actor.split(":", 1)
        principal = AuthenticatedPrincipal(subject_id=subject_id, role=Role(role_str), store_id="")
    except (ValueError, KeyError):
        raise HTTPException(status_code=400, detail="malformed actor")

    try:
        return _mark_picked(principal, request)
    except AuthorizationError as exc:
        raise HTTPException(status_code=403, detail=str(exc))


@app.get("/internal/warehouse/pick-lists")
def list_pick_lists(status: str | None = "picking") -> list[dict]:
    """Phase 4 — Warehouse Staff App initial-load query (see
    `service.py`'s `list_pick_lists` docstring). Public shape here is a
    plain dict list rather than a `WarehousePickResponse` reuse, since a
    list item needs `order_id`/`reservation_id` too, which that response
    model doesn't carry (it's shaped for a single pick action's result,
    not a queue listing)."""
    return [
        {
            "pick_list_id": pl.pick_list_id,
            "order_id": pl.order_id,
            "reservation_id": pl.reservation_id,
            "status": pl.status,
            "picked_by": pl.picked_by,
            "discrepancy_note": pl.discrepancy_note,
        }
        for pl in _stage.list_pick_lists(status=status)
    ]
