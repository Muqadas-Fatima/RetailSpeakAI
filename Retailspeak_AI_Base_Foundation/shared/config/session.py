"""
TDD §7.1 / Plan §Phase 0 — the Redis session-record shape.

Key: session:{session_id} -> this JSON blob, 30-minute sliding TTL.

Every worker behind the load balancer reads this at the top of a turn
and writes it back at the end (TDD §7.1) — no session affinity/sticky
routing required, since neither NLU extraction nor the LLM carries any
memory of prior turns beyond what's in this blob plus the request
payload. N concurrent sessions require N concurrent Redis round-trips,
not N pinned workers.
"""

from __future__ import annotations

from pydantic import BaseModel

SESSION_TTL_SECONDS = 30 * 60  # 30-minute sliding TTL (TDD §7.1)


def session_key(session_id: str) -> str:
    return f"session:{session_id}"


class SessionState(BaseModel):
    store_id: str
    customer_id: str | None = None
    in_progress_order_json: dict | None = None  # partial OrderJSON, pre-confirmation
    turn_history_summary: str | None = None
    language_state: list[str] = []  # e.g. ["ur", "en"]

    # Plan §6 open decision: "Session-expiry re-greeting UX" -> fresh-session
    # init on Redis-miss, no special acknowledgment. Do not build a resume-
    # from-expired-session UX ahead of that decision.
