"""
TDD §4.5 — `POST /v1/fulfillment/orders`, the single, hard boundary
between the two system halves (Foundation Plan §1). Server re-verifies
`confirmation_signature` before enqueueing into LangGraph; a request
with a missing/invalid signature is rejected with `409` (TDD §4.5) --
this endpoint reuses `HMACOrderSigner.verify` from validation-gate
VERBATIM (per validation-gate/signer.py's own docstring: "so Phase 3's
POST /v1/fulfillment/orders can reuse it verbatim"), not a re-derived
copy.

The remaining endpoints here are NOT TDD-numbered -- they're this
scaffold's answer to a real gap in TDD §4.6: two nodes
(`handle_warehouse_pick`, rider assignment after a hold) are entered
from an external event (a human action, or a retry timer), not driven
straight through by the entry point above. In a real deployment this
would be the orchestrator subscribing to each stage's completion event
(Redis pub/sub, per Plan §6) rather than being called over HTTP directly
-- these endpoints are the synchronous stand-in for that, so tests and
the other stage services have a concrete way to hand control back to
the graph without a message bus.

Phase 4 addendum (Execution Plan Prompt §4) — a genuine architecture
finding, flagged rather than silently patched around (Plan §"how to use
this prompt" #4's own instruction: "flag to product if the placeholder
itself seems wrong"): `wiring.build_stage_bundle()` constructs ONE
canonical set of stage-service instances that this module's `_stages`
holds, and every state-changing transition the pipeline actually goes
through updates THOSE instances. `warehouse-stage/api.py`,
`supplier-stage/api.py`, and `delivery-stage/api.py` are each a SEPARATE
FastAPI app with its OWN separate stage-service instance -- faithful to
each stage's real, independently-deployed shape (TDD §13.1), but that
also means a real second `uvicorn` process for e.g. `warehouse-stage`
would never see the pick lists this orchestrator process actually
generates, since Phase 3 never wired an HTTP call (or the Redis
pub/sub this docstring already flags as the missing link) from
orchestrator's in-process call into that separate service. Until that
wiring exists, the dashboard-facing list/action endpoints below read
and write `_stages` directly (the canonical, pipeline-connected
instances) rather than proxying to each standalone service -- the three
Phase 4 clients call these, not the same-named endpoints on the
standalone stage services. Those standalone endpoints are left in place
as the reference implementation of each stage's own contract/auth shape
for whenever the real inter-service call is built.
"""

from __future__ import annotations

import os
import sys
from uuid import uuid4

_HERE = os.path.dirname(os.path.abspath(__file__))
_FULFILLMENT_HALF = os.path.dirname(_HERE)
_REPO_ROOT = os.path.dirname(_FULFILLMENT_HALF)
_NLU_HALF = os.path.join(_REPO_ROOT, "nlu-half")
_VALIDATION_GATE = os.path.join(_NLU_HALF, "validation-gate")
sys.path.insert(0, _REPO_ROOT)
sys.path.insert(0, _FULFILLMENT_HALF)
sys.path.insert(0, _VALIDATION_GATE)
sys.path.insert(0, _HERE)

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from checkpointer import InMemoryCheckpointer
from graph import PipelineGraph
from nodes import Orchestrator, PipelineException
from shared.auth.roles import AuthenticatedPrincipal, Role
from shared.contracts.order import ConfirmedOrder
from shared.realtime.eventbus import make_event
from signer import HMACOrderSigner
from state import PipelineState
from wiring import build_stage_bundle

app = FastAPI(title="orchestrator")

_checkpointer = InMemoryCheckpointer()
_graph = PipelineGraph(_checkpointer)
_stages = build_stage_bundle()
_orchestrator = Orchestrator(_graph, _stages)
_signer = HMACOrderSigner(secret_key=b"test-secret")  # matches wiring.build_stage_bundle's signer


def _principal_from_actor(actor: str) -> AuthenticatedPrincipal:
    """Same "actor string stands in for a decoded JWT claim" placeholder
    used throughout Phase 3's stage endpoints (see
    warehouse-stage/api.py's own docstring on this) -- a real deployment
    decodes a signed JWT here instead of trusting a request-body field."""
    try:
        role_str, subject_id = actor.split(":", 1)
        return AuthenticatedPrincipal(subject_id=subject_id, role=Role(role_str), store_id="")
    except (ValueError, KeyError):
        raise HTTPException(status_code=400, detail=f"malformed actor {actor!r}")


class SubmitOrderResponse(BaseModel):
    order_id: str
    pipeline_run_id: str
    initial_stage: str


class ErrorResponse(BaseModel):
    order_id: str
    stage: str
    reason: str | None = None
    detail: str | None = None


def _load_or_404(order_id: str) -> PipelineState:
    state = _graph.resume(order_id)
    if state is None:
        raise HTTPException(status_code=404, detail=f"no pipeline state for order {order_id}")
    return state


def _require_role(principal: AuthenticatedPrincipal, *roles: Role) -> None:
    if principal.role not in roles:
        raise HTTPException(
            status_code=403, detail=f"role {principal.role.value} not permitted; requires one of {[r.value for r in roles]}"
        )


@app.post("/v1/fulfillment/orders", response_model=SubmitOrderResponse, status_code=202)
def submit_order(confirmed_order: ConfirmedOrder) -> SubmitOrderResponse:
    if not _signer.verify(confirmed_order):
        # TDD §4.5: missing/invalid signature -> 409, never enters fulfillment.
        raise HTTPException(status_code=409, detail="invalid or missing confirmation_signature")

    state = PipelineState(
        order_id=str(confirmed_order.order_id),
        pipeline_run_id=str(uuid4()),
        confirmed_order=confirmed_order,
    )
    _graph.checkpoint(state, detail="placed")

    try:
        state = _orchestrator.start(state)
    except PipelineException as exc:
        # Still 202 -- the order WAS accepted into the pipeline; it just
        # reached a terminal exception state immediately (e.g. the
        # reserved lines went out of stock between confirm and submit).
        # The caller polls/subscribes for status, same as any other
        # async terminal transition (TDD §4.5's response shape only
        # promises `initial_stage`, not a guaranteed non-terminal one).
        return SubmitOrderResponse(
            order_id=exc.state.order_id, pipeline_run_id=exc.state.pipeline_run_id, initial_stage=exc.state.current_stage
        )

    return SubmitOrderResponse(order_id=state.order_id, pipeline_run_id=state.pipeline_run_id, initial_stage=state.current_stage)


class WarehousePickResumeRequest(BaseModel):
    order_id: str
    actor: str
    discrepancy: bool = False
    discrepancy_note: str | None = None


@app.post("/internal/orchestrator/resume/warehouse-pick")
def resume_warehouse_pick(request: WarehousePickResumeRequest) -> dict:
    principal = _principal_from_actor(request.actor)
    _require_role(principal, Role.WAREHOUSE_STAFF)
    state = _load_or_404(request.order_id)
    try:
        state = _orchestrator.handle_warehouse_pick(
            state, actor=request.actor, discrepancy=request.discrepancy, discrepancy_note=request.discrepancy_note
        )
    except PipelineException as exc:
        return {"order_id": exc.state.order_id, "current_stage": exc.state.current_stage, "exception_reason": exc.state.exception_reason}
    return {"order_id": state.order_id, "current_stage": state.current_stage}


class RiderAssignResumeRequest(BaseModel):
    order_id: str
    delivery_address: str
    delivery_lat: float | None = None
    delivery_lng: float | None = None


@app.post("/internal/orchestrator/resume/rider-assign")
def resume_rider_assign(request: RiderAssignResumeRequest) -> dict:
    # System/retry-timer triggered (TDD §5.2), not a human actor call --
    # no role check, matches the un-role-gated `/internal/delivery/assign`
    # this stands in for.
    state = _load_or_404(request.order_id)
    state = _orchestrator.assign_rider(
        state,
        delivery_address=request.delivery_address,
        delivery_lat=request.delivery_lat,
        delivery_lng=request.delivery_lng,
    )
    return {"order_id": state.order_id, "current_stage": state.current_stage, "rider_id": state.rider_id}


class DeliveryStatusResumeRequest(BaseModel):
    order_id: str
    event: str  # "out_for_delivery" | "delivered" | "exception"
    actor: str  # "rider:{id}" -- must match the order's assigned rider_id
    detail: str | None = None


@app.post("/internal/orchestrator/resume/delivery-status")
def resume_delivery_status(request: DeliveryStatusResumeRequest) -> dict:
    principal = _principal_from_actor(request.actor)
    _require_role(principal, Role.RIDER)
    state = _load_or_404(request.order_id)
    if principal.subject_id != state.rider_id:
        # ROLE_PERMISSIONS (shared/auth/roles.py): a rider "cannot view
        # other riders' deliveries" -- extended here to "cannot update"
        # them either, for the same reason (Plan §1.3: every stage
        # boundary re-validates, not just role, but the specific
        # resource ownership too).
        raise HTTPException(status_code=403, detail="rider is not assigned to this order")
    if request.event == "out_for_delivery":
        state = _orchestrator.mark_out_for_delivery(state)
    elif request.event == "delivered":
        state = _orchestrator.mark_delivered(state)
    elif request.event == "exception":
        state = _orchestrator.mark_delivery_exception(state, detail=request.detail or "")
    else:
        raise HTTPException(status_code=400, detail=f"unknown event {request.event}")
    return {"order_id": state.order_id, "current_stage": state.current_stage}


class CancelRequest(BaseModel):
    order_id: str
    actor: str


@app.post("/internal/orchestrator/cancel")
def cancel(request: CancelRequest) -> dict:
    principal = _principal_from_actor(request.actor)
    state = _load_or_404(request.order_id)
    if principal.role == Role.CUSTOMER and principal.subject_id != str(state.confirmed_order.customer_id or ""):
        raise HTTPException(status_code=403, detail="customer does not own this order")
    _require_role(principal, Role.OWNER, Role.CUSTOMER)
    try:
        state = _orchestrator.cancel(state, actor=request.actor)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    return {"order_id": state.order_id, "current_stage": state.current_stage}


class SupplierDecisionResumeRequest(BaseModel):
    po_id: str
    decision: str  # "approved" | "rejected"
    actor: str  # "owner:{id}"
    note: str | None = None


@app.post("/internal/orchestrator/resume/supplier-decision")
def resume_supplier_decision(request: SupplierDecisionResumeRequest) -> dict:
    """Phase 4 addendum (see this module's top docstring): decides
    against `_stages.supplier` -- the SAME instance
    `evaluate_supplier_reorder` drafted the PO into -- rather than
    `supplier-stage/api.py`'s separate standalone instance, so the
    Owner dashboard's approve/reject button actually resolves the PO
    the dashboard is looking at."""
    principal = _principal_from_actor(request.actor)
    _require_role(principal, Role.OWNER)
    try:
        po = _stages.supplier.decide(po_id=request.po_id, decision=request.decision, actor=request.actor, note=request.note)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc))

    state = _graph.resume(str(po.triggered_by_order_id)) if po.triggered_by_order_id else None
    if state is not None:
        _orchestrator._notify(
            state,
            roles=(Role.OWNER,),
            actor=request.actor,
            detail=f"purchase order {request.decision}",
            extra={"po_id": request.po_id, "decision": request.decision},
        )
    return {"po_id": str(po.po_id), "status": po.status}


@app.get("/internal/orchestrator/dashboard/pick-lists")
def dashboard_pick_lists(status: str | None = "picking") -> list[dict]:
    """Phase 4 — Warehouse Staff App's initial-load query, reading the
    canonical `_stages.warehouse` instance (see module docstring)."""
    return [
        {
            "pick_list_id": pl.pick_list_id,
            "order_id": pl.order_id,
            "reservation_id": pl.reservation_id,
            "status": pl.status,
            "picked_by": pl.picked_by,
            "discrepancy_note": pl.discrepancy_note,
        }
        for pl in _stages.warehouse.list_pick_lists(status=status)
    ]


@app.get("/internal/orchestrator/dashboard/pending-pos")
def dashboard_pending_pos(store_id: str | None = None) -> list[dict]:
    """Phase 4 — Owner dashboard's PO-approval queue, reading the
    canonical `_stages.supplier` instance (see module docstring)."""
    return [
        {
            "po_id": str(po.po_id),
            "store_id": str(po.store_id),
            "supplier_id": str(po.supplier_id),
            "lines": [{"product_id": str(l.product_id), "reorder_qty": l.reorder_qty} for l in po.lines],
            "triggered_by_order_id": str(po.triggered_by_order_id) if po.triggered_by_order_id else None,
            "created_at": po.created_at.isoformat(),
        }
        for po in _stages.supplier.list_pending(store_id=store_id)
    ]


@app.get("/internal/orchestrator/dashboard/rider-assignments/{rider_id}")
def dashboard_rider_assignments(rider_id: str) -> list[dict]:
    """Phase 4 — Rider client's "my deliveries" list, reading the
    canonical `_stages.delivery` instance (see module docstring)."""
    return _stages.delivery.list_for_rider(rider_id)


@app.get("/internal/orchestrator/orders/{order_id}")
def get_status(order_id: str) -> dict:
    state = _load_or_404(order_id)
    return {
        "order_id": state.order_id,
        "current_stage": state.current_stage,
        "exception_reason": state.exception_reason,
        "history": [h.stage for h in _checkpointer.history(order_id)],
    }


@app.get("/internal/orchestrator/orders")
def list_orders(store_id: str | None = None) -> list[dict]:
    """Phase 4 (Execution Plan Prompt §4) — backs the Owner dashboard's
    order-overview panel: every order for the Owner's store, its current
    stage, and whether it's sitting in an exception state needing
    attention. This is the REST snapshot a freshly-opened dashboard tab
    loads before the WebSocket (`realtime-gateway/`) starts pushing live
    updates on top of it -- same split as the other stages' new list
    endpoints (warehouse-stage's `/pick-lists`, supplier-stage's
    `/pending-pos`, delivery-stage's `/assignments/{rider_id}`)."""
    orders = []
    for order_id in _graph.list_order_ids():
        state = _graph.resume(order_id)
        if state is None:
            continue
        if store_id and str(state.confirmed_order.store_id) != store_id:
            continue
        orders.append(
            {
                "order_id": state.order_id,
                "current_stage": state.current_stage,
                "exception_reason": state.exception_reason,
                "rider_id": state.rider_id,
                "pick_list_id": state.pick_list_id,
                "po_id": state.po_id,
                "total_amount": state.confirmed_order.total_amount,
            }
        )
    return orders
