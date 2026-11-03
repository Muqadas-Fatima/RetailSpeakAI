"""
Session state store — TDD §1.1, §2.1: "Session State (Upstash Redis) —
per-turn read/write (keeps LLM worker stateless)."

Every turn's evolving draft order, resolved/ambiguous line items, and
conversation intent history lives here, keyed by session_id, so any
stateless worker in the pool can serve any turn of any session.
"""
import json
from typing import Any

from redis.asyncio import Redis

from app.config import get_settings

settings = get_settings()

_redis: Redis | None = None


def get_redis() -> Redis:
    global _redis
    if _redis is None:
        _redis = Redis.from_url(settings.redis_url, decode_responses=True)
    return _redis


class SessionStore:
    """Thin wrapper around Redis for per-session conversation state."""

    def __init__(self, redis: Redis | None = None):
        self.redis = redis or get_redis()
        self.ttl = settings.session_ttl_seconds

    def _key(self, session_id: str) -> str:
        return f"session:{session_id}"

    async def get(self, session_id: str) -> dict[str, Any] | None:
        raw = await self.redis.get(self._key(session_id))
        if raw is None:
            return None
        return json.loads(raw)

    async def set(self, session_id: str, state: dict[str, Any]) -> None:
        await self.redis.set(self._key(session_id), json.dumps(state, default=str), ex=self.ttl)

    async def init_if_absent(self, session_id: str, store_id: str, customer_id: str | None) -> dict[str, Any]:
        """
        Fresh-session initialization on Redis-miss, with no special
        acknowledgment to the customer — Foundation Plan §10's stated
        baseline for the session-expiry re-greeting open question.
        """
        existing = await self.get(session_id)
        if existing is not None:
            return existing
        fresh_state = {
            "session_id": session_id,
            "store_id": store_id,
            "customer_id": customer_id,
            "channel": None,
            "draft_order_lines": [],
            "ambiguous_items": [],
            "not_found_items": [],
            "intent_history": [],
            "confirmed": False,
        }
        await self.set(session_id, fresh_state)
        return fresh_state

    async def delete(self, session_id: str) -> None:
        await self.redis.delete(self._key(session_id))
