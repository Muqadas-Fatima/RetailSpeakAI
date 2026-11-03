"""
TDD §4.6 — `POST /internal/inventory/reserve`, `POST /internal/inventory/release`.
Orchestrator-only (system actor), mTLS + service JWT scoped to
{order_id, stage_name} in production (TDD §8.1) -- JWT verification is a
transport-layer concern handled by the service mesh / API gateway, not
reimplemented in this scaffold (same boundary the other nlu-half api.py
files draw around auth).

Path setup note: same convention as nlu-half services (see
nlu-extraction-service/api.py's docstring).
"""

from __future__ import annotations

import os
import sys

_HERE = os.path.dirname(os.path.abspath(__file__))
_FULFILLMENT_HALF = os.path.dirname(_HERE)
_REPO_ROOT = os.path.dirname(_FULFILLMENT_HALF)
_RAG_SERVICE = os.path.join(_REPO_ROOT, "nlu-half", "rag-retrieval-service")
sys.path.insert(0, _REPO_ROOT)  # -> `shared.*`
sys.path.insert(0, _FULFILLMENT_HALF)  # -> `contracts.*`
sys.path.insert(0, _RAG_SERVICE)  # -> `mock_catalog` (reused, not forked -- see below)
sys.path.insert(0, _HERE)  # this dir -> `store`, `service`

from fastapi import FastAPI

from contracts.pipeline_io import (
    ReleaseInventoryRequest,
    ReleaseInventoryResponse,
    ReserveInventoryRequest,
    ReserveInventoryResponse,
)
from mock_catalog import MockCatalogStore  # same catalog fixture nlu-half already uses
from service import STAGE_NAME, InventoryStage
from shared.idempotency.dedupe import IdempotencyGuard, InMemoryDedupeStore
from store import InMemoryInventoryStore

# Swap these two lines for a real Postgres-backed store and a shared
# Redis-backed dedupe store when they're ready; nothing else in this
# file changes (same "seam" pattern as validation-gate/api.py). Reusing
# MockCatalogStore's fixture products (not forking a second one) means
# the low-stock "Sunflower Oil 1L" row that seeds the supplier-stage
# demo (Phase 1's mock_catalog.py docstring) starts already-low here too.
_catalog = MockCatalogStore()
app = FastAPI(title="inventory-stage")

_stage = InventoryStage(
    store=InMemoryInventoryStore(_catalog._products),
    idempotency=IdempotencyGuard(InMemoryDedupeStore()),
)


@app.post("/internal/inventory/reserve", response_model=ReserveInventoryResponse)
def reserve(request: ReserveInventoryRequest) -> ReserveInventoryResponse:
    key = f"{request.order_id}:{STAGE_NAME}:reserve"
    result = _stage.reserve(
        order_id=request.order_id,
        store_id=request.store_id,
        line_items=[(li.product_id, li.quantity) for li in request.line_items],
        idempotency_key=key,
    )
    return ReserveInventoryResponse(**result)


@app.post("/internal/inventory/release", response_model=ReleaseInventoryResponse)
def release(request: ReleaseInventoryRequest) -> ReleaseInventoryResponse:
    key = f"{request.reservation_id}:{STAGE_NAME}:release:{request.reason}"
    result = _stage.release(
        reservation_id=request.reservation_id, reason=request.reason, idempotency_key=key
    )
    return ReleaseInventoryResponse(**result)
