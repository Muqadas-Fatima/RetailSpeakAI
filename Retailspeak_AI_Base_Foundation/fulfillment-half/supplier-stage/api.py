"""
TDD §4.6 — `POST /internal/supplier/reorder` (orchestrator/system) and
`POST /internal/supplier/reorder-decision` (Owner-only human actor, via
Owner dashboard). See warehouse-stage/api.py's docstring for the same
service-JWT + role-JWT dual-check pattern applied here to `owner`
instead of `warehouse_staff`.
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

from contracts.pipeline_io import (
    SupplierReorderDecisionRequest,
    SupplierReorderDecisionResponse,
    SupplierReorderRequest,
    SupplierReorderResponse,
)
from service import SupplierStage
from shared.auth.roles import AuthenticatedPrincipal, AuthorizationError, Role, require_role

app = FastAPI(title="supplier-stage")
_stage = SupplierStage()


@app.post("/internal/supplier/reorder", response_model=SupplierReorderResponse)
def reorder(request: SupplierReorderRequest) -> SupplierReorderResponse:
    po = _stage.draft_reorder(
        store_id=request.store_id,
        product_id=request.product_id,
        triggered_by_order_id=request.triggered_by_order_id,
        reorder_qty=request.reorder_qty,
    )
    return SupplierReorderResponse(po_id=str(po.po_id), status=po.status)


@require_role(Role.OWNER)
def _decide(principal: AuthenticatedPrincipal, request: SupplierReorderDecisionRequest) -> SupplierReorderDecisionResponse:
    po = _stage.decide(po_id=request.po_id, decision=request.decision, actor=request.actor, note=request.note)
    return SupplierReorderDecisionResponse(po_id=str(po.po_id), status=po.status)


@app.post("/internal/supplier/reorder-decision", response_model=SupplierReorderDecisionResponse)
def reorder_decision(request: SupplierReorderDecisionRequest) -> SupplierReorderDecisionResponse:
    try:
        role_str, subject_id = request.actor.split(":", 1)
        principal = AuthenticatedPrincipal(subject_id=subject_id, role=Role(role_str), store_id="")
    except (ValueError, KeyError):
        raise HTTPException(status_code=400, detail="malformed actor")

    try:
        return _decide(principal, request)
    except AuthorizationError as exc:
        raise HTTPException(status_code=403, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc))


@app.get("/internal/supplier/pending-pos")
def list_pending_pos(store_id: str | None = None) -> list[dict]:
    """Phase 4 — Owner dashboard's PO-approval queue (see `service.py`'s
    `list_pending` docstring)."""
    return [
        {
            "po_id": str(po.po_id),
            "store_id": str(po.store_id),
            "supplier_id": str(po.supplier_id),
            "lines": [{"product_id": str(l.product_id), "reorder_qty": l.reorder_qty} for l in po.lines],
            "triggered_by_order_id": str(po.triggered_by_order_id) if po.triggered_by_order_id else None,
            "created_at": po.created_at.isoformat(),
        }
        for po in _stage.list_pending(store_id=store_id)
    ]
