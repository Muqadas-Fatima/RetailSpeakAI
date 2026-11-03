"""
TDD §2.8 / §4.6 — "Redis pub/sub -> WebSocket gateway" as its own
deployable component (Foundation Plan §3's per-service isolation: each
service in the topology ships its own container, TDD §13.1). Every
other Phase 3 stage service is REST because the orchestrator drives it;
this one is the exception the TDD's own table calls out, and Phase 4
(Execution Plan Prompt §4) is what actually gives it a caller -- the
three dashboards.

`GET /ws/{store_id}/{role}` upgrades to a WebSocket and streams
`DashboardEvent`s (`shared/realtime/eventbus.py`) as they're published.
`role=rider` additionally requires `?recipient_id={rider_id}` in the
query string -- the same recipient-scoping the event bus itself enforces
(a rider's socket literally cannot subscribe to another rider's channel,
independent of anything the client-side code does or doesn't check).

Auth note (matches warehouse-stage/api.py's and supplier-stage/api.py's
own docstring on this): a real deployment authenticates the WebSocket
upgrade against the caller's JWT (Cognito-issued, TDD §8.1) before ever
accepting the connection, and rejects a `rider` socket whose JWT
`subject_id` doesn't match the `recipient_id` it's asking to subscribe
to. This scaffold takes `role`/`recipient_id` from the URL directly
(no JWT decoding implemented anywhere in this repo yet, Phase 3's same
`actor` string-carries-the-claim placeholder) -- swapping in real auth
touches only the connection-accept step below, not the pub/sub wiring.
"""

from __future__ import annotations

import asyncio
import os
import sys

_HERE = os.path.dirname(os.path.abspath(__file__))
_FULFILLMENT_HALF = os.path.dirname(_HERE)
_REPO_ROOT = os.path.dirname(_FULFILLMENT_HALF)
sys.path.insert(0, _REPO_ROOT)

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from pydantic import BaseModel

from shared.auth.roles import Role
from shared.realtime.eventbus import DashboardEvent, default_event_bus

app = FastAPI(title="realtime-gateway")
_bus = default_event_bus()


def _serialize(event: DashboardEvent) -> dict:
    return {
        "order_id": str(event.status_event.order_id),
        "stage": event.status_event.stage.value,
        "occurred_at": event.status_event.occurred_at.isoformat(),
        "detail": event.status_event.detail,
        "actor": event.status_event.actor,
        "extra": event.extra,
    }


@app.websocket("/ws/{store_id}/{role}")
async def dashboard_socket(websocket: WebSocket, store_id: str, role: str, recipient_id: str | None = None) -> None:
    try:
        role_enum = Role(role)
    except ValueError:
        await websocket.close(code=4400, reason=f"unknown role {role}")
        return
    if role_enum == Role.CUSTOMER:
        # shared/realtime/eventbus.py's own docstring: customers are
        # never a publish target on this bus (they get SMS/WhatsApp/
        # voice via the Notification stage instead) -- so there is
        # nothing this channel would ever deliver to a customer socket.
        await websocket.close(code=4403, reason="customer role has no dashboard channel")
        return
    if role_enum == Role.RIDER and not recipient_id:
        await websocket.close(code=4400, reason="rider subscriptions require ?recipient_id={rider_id}")
        return

    await websocket.accept()
    loop = asyncio.get_running_loop()

    # Backfill first (TDD §5's "resume from last committed state" spirit,
    # applied to the live-event view too) so a tab that just opened isn't
    # staring at a blank screen until the next event happens to fire.
    for event in _bus.backfill(store_id=store_id, role=role_enum, recipient_id=recipient_id):
        await websocket.send_json(_serialize(event))

    def _on_event(event: DashboardEvent) -> None:
        # `EventBus.publish()` calls subscribers synchronously and is
        # itself called from ordinary (non-async) orchestrator code
        # (nodes.py) -- possibly from a different thread than this
        # connection's event loop (a real ASGI server runs each
        # connection's handler on the loop, while `publish()` could be
        # invoked from a worker thread or another request's task). This
        # callback can't `await` directly, and `asyncio.create_task`
        # requires a loop already running *in the calling thread* -- so
        # this schedules onto the loop captured above via
        # `call_soon_threadsafe`, which is safe to call from anywhere.
        loop.call_soon_threadsafe(asyncio.create_task, websocket.send_json(_serialize(event)))

    unsubscribe = _bus.subscribe(store_id=store_id, role=role_enum, callback=_on_event, recipient_id=recipient_id)
    try:
        while True:
            # No client->server messages are expected on this channel
            # (TDD §4.6's role/state-changing actions all go through the
            # normal REST endpoints, e.g. `/internal/warehouse/pick`) --
            # this recv() only exists to detect disconnect promptly.
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        unsubscribe()


class HealthResponse(BaseModel):
    status: str = "ok"


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse()
