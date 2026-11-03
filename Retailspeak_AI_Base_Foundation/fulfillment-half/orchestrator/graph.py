"""
TDD §2.7 — "LangGraph (Python), backed by Postgres checkpointer... an
explicit graph of typed nodes/edges with built-in checkpointing and
human-in-the-loop interrupt support." Foundation Plan §3 stack item #7
lists `langgraph` itself as a bootstrap dependency, "wired into
orchestrator/ scaffolding starts (Phase 0/3)".

This module is that wiring point: `PipelineGraph` gives `nodes.py` the
same three primitives a real LangGraph `StateGraph` would (register a
node, checkpoint after every transition, pause on `interrupt()`) without
requiring the `langgraph` package to be installed to read, test, or run
this scaffold. Swapping this for the real package is a rewrite of THIS
file only -- `nodes.py`'s node functions (the actual TDD §5 transition
logic) are written against `PipelineGraph`'s interface, not against
`langgraph`'s, so they don't change.

Every call to `checkpoint()` is exactly the "persist state after every
node transition" requirement from TDD §5.5 / Plan §6.2 -- `nodes.py`
calls it after each stage's side effect, never batching several
transitions into one save.
"""

from __future__ import annotations

from checkpointer import Checkpointer
from state import PipelineState


class GraphInterrupt(Exception):
    """
    Raised by a node function to pause the graph at a human-in-the-loop
    checkpoint (TDD §5.3's Owner-approval interrupt is the only v1 case,
    but the mechanism is generic). Mirrors `langgraph.interrupt()`
    semantics: the graph stops advancing, the current PipelineState is
    already checkpointed, and execution resumes later via
    `PipelineGraph.resume()` once the external decision arrives (the
    Owner's `reorder-decision` call, TDD §4.6).

    Unlike a rollback-triggering exception (TDD §5.4), a GraphInterrupt
    is NOT a failure -- nothing compensates when this is raised, the
    graph is simply waiting.
    """

    def __init__(self, reason: str, detail: str | None = None) -> None:
        super().__init__(reason)
        self.reason = reason
        self.detail = detail


class PipelineGraph:
    def __init__(self, checkpointer: Checkpointer) -> None:
        self._checkpointer = checkpointer

    def checkpoint(self, state: PipelineState, *, actor: str = "system", detail: str | None = None) -> None:
        """The one place `nodes.py` persists state -- called after every
        successful transition, per TDD §5.5."""
        self._checkpointer.save(state, actor=actor, detail=detail)

    def resume(self, order_id: str) -> PipelineState | None:
        """TDD §5.5: "a worker crash mid-pipeline resumes from the last
        committed stage on restart rather than replaying from `placed`."
        Returns the last checkpointed PipelineState, or None if this
        order_id was never checkpointed at all (i.e. it never reached
        the orchestrator, not a resumability failure)."""
        return self._checkpointer.load(order_id)

    def list_order_ids(self) -> list[str]:
        """Phase 4: passthrough for the Owner dashboard's overview list
        -- see `checkpointer.py`'s `list_order_ids` docstring."""
        return self._checkpointer.list_order_ids()
