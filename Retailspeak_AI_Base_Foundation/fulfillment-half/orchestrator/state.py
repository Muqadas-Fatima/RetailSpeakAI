"""
TDD §2.7, §5.1-§5.2, §9.1 (`orders` / `order_status_events` tables) —
the state object LangGraph threads through every node.

`committed_stages` is what TDD §5.4's rollback walk reads: "LangGraph
tracks which stages have committed side effects for a given order_id in
its checkpoint state, and on a failure event walks that list in reverse,
calling each stage's documented compensating endpoint." A stage appends
itself here only once its side effect has actually landed (reservation
created, payment charged/khata posted) -- never speculatively before the
call, and never for a stage whose call failed outright (nothing to
compensate for a call that never committed).

This state is exactly what `orchestrator/checkpointer.py` persists after
every node transition (Plan §6.2 / TDD §5.5), so a worker crash mid-
pipeline resumes from here rather than replaying from `placed`.
"""

from __future__ import annotations

from pydantic import BaseModel, Field

from shared.contracts.fulfillment import FulfillmentStage
from shared.contracts.order import ConfirmedOrder


class CommittedStage(BaseModel):
    """One entry per stage that has committed a side effect for this
    order, in the order they committed -- TDD §5.4's rollback walk
    reverses this list. `compensation_ref` is whatever the stage needs
    to reverse itself (a reservation_id, a transaction_ref, a
    khata entry's customer_id+amount) -- opaque to the orchestrator,
    meaningful only to the stage that produced it."""

    stage_name: str
    compensation_ref: dict = Field(default_factory=dict)


class PipelineState(BaseModel):
    order_id: str
    pipeline_run_id: str
    confirmed_order: ConfirmedOrder
    current_stage: FulfillmentStage = FulfillmentStage.PLACED
    committed_stages: list[CommittedStage] = Field(default_factory=list)

    # Populated as stages commit -- kept on the state object (rather than
    # re-fetched from each stage) so a resumed pipeline (TDD §5.5) has
    # everything downstream nodes need without re-querying every prior
    # stage's own storage.
    reservation_id: str | None = None
    transaction_ref: str | None = None
    khata_entry_id: str | None = None
    pick_list_id: str | None = None
    po_id: str | None = None  # supplier-reorder branch, only if triggered
    rider_id: str | None = None
    route_id: str | None = None

    exception_reason: str | None = None
    exception_detail: str | None = None
    retry_attempt: int = 0  # for the exponential-backoff retry policy, TDD §5.5

    def mark_committed(self, stage_name: str, compensation_ref: dict) -> None:
        self.committed_stages.append(CommittedStage(stage_name=stage_name, compensation_ref=compensation_ref))

    def committed_stage_names_reversed(self) -> list[CommittedStage]:
        """TDD §5.4: "walks that list in reverse" -- the exact order
        rollback compensations must fire in (undo payment before
        inventory, since payment was committed after inventory)."""
        return list(reversed(self.committed_stages))
