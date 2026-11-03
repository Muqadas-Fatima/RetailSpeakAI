"""
TDD §4.6 — `POST /internal/payment/charge`, `POST /internal/khata/post`.
Orchestrator-only, internal mTLS surface (TDD §8.1). See inventory-
stage/api.py's docstring for the auth/transport-layer boundary note.

Note this file exposes the two TDD-numbered endpoints separately (as the
TDD itself specifies them, §4.6) even though both are backed by the same
`PaymentKhataStage.settle()` -- the orchestrator's guard condition (TDD
§5.3: `payment_method == "khata"`) decides which endpoint it calls, not
this file.
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
    ChargePaymentRequest,
    ChargePaymentResponse,
    PostKhataRequest,
    PostKhataResponse,
)
from gateway import gateway_for
from khata_ledger import InMemoryKhataLedger
from service import STAGE_NAME, PaymentKhataStage
from shared.idempotency.dedupe import IdempotencyGuard, InMemoryDedupeStore

# Phase 3 dev-mode customer fixture -- a khata-enabled customer with a
# credit limit, so the over-limit path (TDD §5.3, §12) is reachable
# without wiring a real customers table yet.
from _customer_fixtures import fixture_customers  # noqa: E402

app = FastAPI(title="payment-khata-stage")

_ledger = InMemoryKhataLedger(fixture_customers())
_stage = PaymentKhataStage(
    khata_ledger=_ledger, gateway_factory=gateway_for, idempotency=IdempotencyGuard(InMemoryDedupeStore())
)


@app.post("/internal/payment/charge", response_model=ChargePaymentResponse)
def charge(request: ChargePaymentRequest) -> ChargePaymentResponse:
    result = _stage.settle(
        order_id=request.order_id,
        store_id="",
        customer_id=None,
        payment_method=request.payment_method,
        stated_total_amount=request.amount,
        line_items=request.line_items,
        idempotency_key=f"{request.order_id}:{STAGE_NAME}:charge",
    )
    if result["outcome"] == "payment_failed":
        raise HTTPException(status_code=402, detail=result)
    return ChargePaymentResponse(transaction_ref=result["transaction_ref"], status="success")


@app.post("/internal/khata/post", response_model=PostKhataResponse)
def post_khata(request: PostKhataRequest) -> PostKhataResponse:
    result = _stage.settle(
        order_id=request.order_id,
        store_id=request.store_id,
        customer_id=request.customer_id,
        payment_method="khata",
        stated_total_amount=request.amount,
        line_items=[],  # khata posts a pre-agreed amount; recompute happens on the charge path only
        idempotency_key=f"{request.order_id}:{STAGE_NAME}:khata_post",
    )
    if result["outcome"] == "payment_failed" and result["reason"] == "over_credit_limit":
        raise HTTPException(status_code=422, detail=result)
    if result["outcome"] == "payment_failed":
        raise HTTPException(status_code=402, detail=result)
    return PostKhataResponse(entry_id=result["khata_entry_id"], new_balance=result["new_balance"])
