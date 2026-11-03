"""
TDD §2.8 (Notification stage) / §4.6 — push order-status events to
Customer (voice/SMS/WhatsApp) and Owner + Warehouse Staff (dashboard,
WebSocket). TDD §4.6's rollback column is explicit: "Notification
failure never rolls back fulfillment -- logged and retried async,
non-blocking." This is the one stage whose failure NEVER produces a
pipeline-level exception state; `send` always returns a result, never
raises, so the orchestrator node calling it (nodes.py) can fire it and
move on regardless of outcome.

Real implementation: Redis pub/sub -> WebSocket gateway for
dashboard/in-app channels, Twilio/WhatsApp Business API for SMS/WhatsApp
(TDD §2.8 table). This mock just records sends in-memory so tests can
assert a notification was attempted, without a message-bus dependency.
"""

from __future__ import annotations

from dataclasses import dataclass, field

STAGE_NAME = "notification"


@dataclass
class SentNotification:
    order_id: str
    stage: str
    channel: str
    delivery_status: str


class NotificationStage:
    def __init__(self, force_channel_failure: bool = False) -> None:
        self._force_failure = force_channel_failure
        self.sent: list[SentNotification] = []

    def send(self, *, order_id: str, stage: str, channel: str) -> SentNotification:
        status = "queued_for_retry" if self._force_failure else "sent"
        record = SentNotification(order_id=order_id, stage=stage, channel=channel, delivery_status=status)
        self.sent.append(record)
        return record
