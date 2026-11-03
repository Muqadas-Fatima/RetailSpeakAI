"""
TDD §2.6, §4.4-§4.5 — validation-gate's HTTP surface.

POST /v1/nlu/validate-order  — run right after grounding (§4.4), on
    every turn. Decides ConfirmationTurnOutcome; only READY_TO_CONFIRM
    carries a validated_order.
POST /v1/nlu/confirm-order   — called once the customer's turn intent is
    CONFIRM and the prior validate-order call returned READY_TO_CONFIRM.
    Returns the signed ConfirmedOrder -- the artifact the (not-yet-built,
    Phase 3) POST /v1/fulfillment/orders endpoint consumes (TDD §4.5).

Path setup note: same convention as the other nlu-half services (see
nlu-extraction-service/api.py's docstring) -- each service ships its own
container/PYTHONPATH; this sys.path setup makes the scaffold runnable
as-is without extra config.
"""

from __future__ import annotations

import os
import sys

_HERE = os.path.dirname(os.path.abspath(__file__))
_NLU_HALF = os.path.dirname(_HERE)
_RAG_SERVICE = os.path.join(_NLU_HALF, "rag-retrieval-service")
sys.path.insert(0, os.path.dirname(_NLU_HALF))  # repo root -> `shared.*`
sys.path.insert(0, _NLU_HALF)  # nlu-half/    -> `contracts.*`
sys.path.insert(0, _RAG_SERVICE)  # -> `mock_catalog` (reused, not forked -- see gate.py)
sys.path.insert(0, _HERE)  # this dir -> `gate`, `signer`, `confirmation`

from fastapi import FastAPI, HTTPException

from confirmation import ConfirmationTurn
from contracts.pipeline_io import (
    ConfirmOrderRequest,
    ConfirmOrderResponse,
    ValidateDraftOrderRequest,
    ValidateDraftOrderResponse,
)
from gate import MockCatalogLookup, PydanticValidationGate, ValidationGate
from mock_catalog import MockCatalogStore
from signer import HMACOrderSigner, OrderSigner

app = FastAPI(title="validation-gate")

# Swap these two lines for the real Postgres-backed catalog lookup and
# KMS-backed signer when they're ready; nothing else in this file changes.
_gate: ValidationGate = PydanticValidationGate(catalog=MockCatalogLookup(MockCatalogStore()))
_signer: OrderSigner = HMACOrderSigner()
_confirmation_turn = ConfirmationTurn(gate=_gate)


@app.post("/v1/nlu/validate-order", response_model=ValidateDraftOrderResponse)
def validate_order(request: ValidateDraftOrderRequest) -> ValidateDraftOrderResponse:
    return _confirmation_turn.evaluate(request)


@app.post("/v1/nlu/confirm-order", response_model=ConfirmOrderResponse)
def confirm_order(request: ConfirmOrderRequest) -> ConfirmOrderResponse:
    if not request.validated_order.line_items:
        # Defense in depth: a caller that skips validate-order (or replays
        # a stale response) must not be able to sign an empty/unvalidated
        # order (Plan §1.3 — every stage boundary re-checks, this
        # endpoint is one).
        raise HTTPException(status_code=422, detail="order has no validated line items")
    if request.validated_order.confirmed:
        raise HTTPException(status_code=409, detail="order is already confirmed")

    confirmed_order = _signer.sign_and_stamp(request.validated_order)
    return ConfirmOrderResponse(confirmed_order=confirmed_order)


@app.post("/v1/nlu/_internal/verify-signature")
def verify_signature(confirmed_order: dict) -> dict:
    """
    Not a TDD-numbered endpoint -- a thin debugging/ops surface so the
    signature-verification logic Phase 3's fulfillment-order endpoint
    needs (TDD §4.5: re-verify before enqueueing, 409 on failure) can be
    exercised here ahead of that endpoint existing. Phase 3 imports
    HMACOrderSigner.verify directly rather than calling this over HTTP.
    """
    from shared.contracts.order import ConfirmedOrder as ConfirmedOrderModel

    order = ConfirmedOrderModel(**confirmed_order)
    return {"valid": _signer.verify(order)}
