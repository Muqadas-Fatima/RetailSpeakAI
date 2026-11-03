"""
Plan §Phase 0: "Structured JSON logging library (correlated by
order_id/session_id/pipeline_run_id)".

Every service in both halves imports get_logger() from here rather
than configuring its own logging — this is the same "shared, one
copy" principle as shared/contracts (Plan §1.7), applied to
observability instead of schema.

Usage:
    from shared.logging.logger import get_logger
    log = get_logger("inventory-stage")
    log.info("reservation attempt", order_id=order_id, product_id=product_id)
"""

from __future__ import annotations

import json
import logging
import sys
import time
from contextvars import ContextVar
from typing import Any

# Correlation IDs are set per-request/per-turn and picked up automatically
# by every log call on that async/thread context — callers don't have to
# thread order_id through every function signature just to log it.
_session_id: ContextVar[str | None] = ContextVar("session_id", default=None)
_order_id: ContextVar[str | None] = ContextVar("order_id", default=None)
_pipeline_run_id: ContextVar[str | None] = ContextVar("pipeline_run_id", default=None)


def bind_correlation_ids(
    *,
    session_id: str | None = None,
    order_id: str | None = None,
    pipeline_run_id: str | None = None,
) -> None:
    """Call once at the top of a request/turn handler."""
    if session_id is not None:
        _session_id.set(session_id)
    if order_id is not None:
        _order_id.set(order_id)
    if pipeline_run_id is not None:
        _pipeline_run_id.set(pipeline_run_id)


class _JSONFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "ts": time.time(),
            "level": record.levelname,
            "service": getattr(record, "service", "unknown"),
            "message": record.getMessage(),
            "session_id": _session_id.get(),
            "order_id": _order_id.get(),
            "pipeline_run_id": _pipeline_run_id.get(),
        }
        extra = getattr(record, "extra_fields", None)
        if extra:
            payload.update(extra)
        if record.exc_info:
            payload["exc_info"] = self.formatException(record.exc_info)
        return json.dumps(payload, default=str)


class ServiceLoggerAdapter(logging.LoggerAdapter):
    """Lets call sites pass structured kwargs: log.info('msg', product_id=x)."""

    def process(self, msg, kwargs):  # type: ignore[override]
        extra_fields = {
            k: v for k, v in kwargs.items() if k not in ("exc_info", "stack_info")
        }
        for k in extra_fields:
            kwargs.pop(k)
        kwargs.setdefault("extra", {})
        kwargs["extra"]["extra_fields"] = extra_fields
        kwargs["extra"]["service"] = self.extra["service"]
        return msg, kwargs


def get_logger(service_name: str) -> ServiceLoggerAdapter:
    logger = logging.getLogger(service_name)
    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(_JSONFormatter())
        logger.addHandler(handler)
        logger.setLevel(logging.INFO)
        logger.propagate = False
    return ServiceLoggerAdapter(logger, {"service": service_name})
