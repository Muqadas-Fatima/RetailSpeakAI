"""
TDD §2.7, §5.5 / Foundation Plan §6.2 — "The checkpointer persists graph
state after every node transition; on a worker crash/restart, the
pipeline resumes from the last committed checkpoint, never replaying
from `placed`." This is core orchestrator/ infrastructure, not a later
hardening pass (Plan §6.2's own framing) -- which is why it's built here
in Phase 3 alongside the graph itself, not deferred to Phase 5.

Phase 3 mock: in-memory dict, keyed by order_id, storing the latest
PipelineState snapshot plus a full transition history for audit
(mirrors `order_status_events`, TDD §9.1). Production swap: LangGraph's
own Postgres checkpointer (the actual `langgraph.checkpoint.postgres`
integration) -- same `save`/`load` interface, so `graph.py`'s
`GraphRunner` doesn't change when the real backend is wired in.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime, timezone

from state import PipelineState


@dataclass
class _CheckpointHistoryEntry:
    stage: str
    occurred_at: datetime
    actor: str
    detail: str | None = None


class Checkpointer(ABC):
    @abstractmethod
    def save(self, state: PipelineState, actor: str = "system", detail: str | None = None) -> None: ...

    @abstractmethod
    def load(self, order_id: str) -> PipelineState | None: ...

    @abstractmethod
    def history(self, order_id: str) -> list[_CheckpointHistoryEntry]: ...

    @abstractmethod
    def list_order_ids(self) -> list[str]:
        """Phase 4: backs the Owner dashboard's order-overview list
        (`GET /internal/orchestrator/orders`, orchestrator/api.py). Not
        needed by Phase 3's pipeline logic itself -- every Phase 3 call
        already knows its own `order_id` -- which is why this wasn't on
        the interface until the Owner dashboard needed to enumerate
        orders it doesn't already have an ID for."""


class InMemoryCheckpointer(Checkpointer):
    def __init__(self) -> None:
        self._snapshots: dict[str, PipelineState] = {}
        self._history: dict[str, list[_CheckpointHistoryEntry]] = {}

    def save(self, state: PipelineState, actor: str = "system", detail: str | None = None) -> None:
        self._snapshots[state.order_id] = state.model_copy(deep=True)
        self._history.setdefault(state.order_id, []).append(
            _CheckpointHistoryEntry(
                stage=state.current_stage.value,
                occurred_at=datetime.now(timezone.utc),
                actor=actor,
                detail=detail,
            )
        )

    def load(self, order_id: str) -> PipelineState | None:
        return self._snapshots.get(order_id)

    def history(self, order_id: str) -> list[_CheckpointHistoryEntry]:
        return list(self._history.get(order_id, []))

    def list_order_ids(self) -> list[str]:
        return list(self._snapshots.keys())
