"""TDD §4.6 — `POST /internal/notify/send`. Orchestrator-only, always
returns 200 regardless of delivery_status (see service.py docstring:
notification failure never rolls back fulfillment)."""

from __future__ import annotations

import os
import sys

_HERE = os.path.dirname(os.path.abspath(__file__))
_FULFILLMENT_HALF = os.path.dirname(_HERE)
_REPO_ROOT = os.path.dirname(_FULFILLMENT_HALF)
sys.path.insert(0, _REPO_ROOT)
sys.path.insert(0, _FULFILLMENT_HALF)
sys.path.insert(0, _HERE)

from fastapi import FastAPI

from contracts.pipeline_io import NotifySendRequest, NotifySendResponse
from service import NotificationStage

app = FastAPI(title="notification-stage")
_stage = NotificationStage()


@app.post("/internal/notify/send", response_model=NotifySendResponse)
def send(request: NotifySendRequest) -> NotifySendResponse:
    result = _stage.send(order_id=request.order_id, stage=request.stage, channel=request.channel)
    return NotifySendResponse(delivery_status=result.delivery_status)
