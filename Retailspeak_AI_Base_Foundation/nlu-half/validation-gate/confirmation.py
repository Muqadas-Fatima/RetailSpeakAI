"""
TDD §4.4 — the confirmation turn: "Any item in ambiguous_items or
not_found_items blocks confirmation for that line until resolved by the
customer." Combined with §2.6, a draft order becomes confirmable only
once BOTH are true:
  1. grounding produced no ambiguous_items and no not_found_items, AND
  2. every line_item that DID get produced passes the Pydantic gate.

This module owns that combined decision and the customer-facing reprompt
text (TDD §2.6's own example phrasing: "Sunlight soap 1kg — not found,
did you mean 500g?") -- gate.py only knows pass/fail-with-reasons, it
has no notion of "turn" or "customer-facing text."
"""

from __future__ import annotations

from uuid import UUID

from contracts.pipeline_io import (
    AmbiguousItem,
    ConfirmationTurnOutcome,
    ValidateDraftOrderRequest,
    ValidateDraftOrderResponse,
)
from gate import ValidationGate


def _build_reprompt(
    ambiguous_items: list[AmbiguousItem],
    not_found_items: list[str],
    rejected_lines,
) -> str:
    parts: list[str] = []
    for item in ambiguous_items:
        options = " or ".join(item.options)
        parts.append(f"{item.raw_mention} — did you mean {options}?")
    for mention in not_found_items:
        parts.append(f"{mention} — not found")
    for rejected in rejected_lines:
        parts.append(rejected.detail)
    return " ".join(parts)


class ConfirmationTurn:
    def __init__(self, gate: ValidationGate) -> None:
        self._gate = gate

    def evaluate(self, request: ValidateDraftOrderRequest) -> ValidateDraftOrderResponse:
        # Step 1 (TDD §4.4): outstanding ambiguous/not-found mentions
        # block confirmation outright -- the gate never even runs on a
        # turn like this, since the customer hasn't finished resolving
        # what they meant yet.
        if request.ambiguous_items or request.not_found_items:
            return ValidateDraftOrderResponse(
                outcome=ConfirmationTurnOutcome.BLOCKED_UNRESOLVED_ITEMS,
                reprompt=_build_reprompt(request.ambiguous_items, request.not_found_items, []),
            )

        # Step 2 (TDD §2.6): every remaining line_item re-verified
        # against the live catalog.
        validated_order, rejected_lines = self._gate.validate(UUID(request.store_id), request.draft_order)

        if rejected_lines:
            return ValidateDraftOrderResponse(
                outcome=ConfirmationTurnOutcome.BLOCKED_GATE_REJECTED,
                rejected_lines=rejected_lines,
                reprompt=_build_reprompt([], [], rejected_lines),
            )

        return ValidateDraftOrderResponse(
            outcome=ConfirmationTurnOutcome.READY_TO_CONFIRM,
            validated_order=validated_order,
        )
