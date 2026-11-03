"""
nlu-half/contracts/pipeline_io.py — request/response shapes for the
three-stage extraction pipeline (TDD §4.2–§4.4):
    nlu-extraction-service -> rag-retrieval-service -> llm-grounding-service

These are deliberately NOT added to shared/contracts/. shared/contracts
(Execution Plan §1.7) is the fixed, ten-model, cross-half boundary set —
the only artifact fulfillment-half ever sees is a signed ConfirmedOrder
built from shared.contracts.order. This module is intra-nlu-half
plumbing: fulfillment-half never imports it, and it isn't one of the
ten models the Plan names.

Still "shared, one copy" in spirit (Plan §1.7) — just scoped to nlu-half
so its three services don't quietly drift on what a "mention" or
"candidate" looks like.

draft_order in GroundAndAssembleResponse reuses shared.contracts.order.
OrderJSON directly rather than forking a parallel shape — TDD §3.1 IS
the draft Order JSON's contract; there's no separate "draft" schema.
"""

from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, Field

from shared.config.session import SessionState
from shared.contracts.order import ConfirmedOrder, OrderJSON


class ItemMention(BaseModel):
    raw_mention: str
    product_name: str | None = None
    brand: str | None = None
    quantity_hint: float | None = None
    unit_hint: str | None = None
    size_or_volume: str | None = None
    customizations: list[str] = Field(default_factory=list)
    item_intent: str = "add"  # "add" | "modify" | "remove"
    confidence: float = Field(default=0.90, ge=0.0, le=1.0)
    refers_to_line_id: str | None = None  # TDD §2.3 — correction/substitution target


# --- 4.2: Transcript/Chat -> NLU Extraction (non-LLM) ---


class ExtractMentionsRequest(BaseModel):
    session_id: str
    store_id: str
    input_text: str
    channel: str  # "voice" | "chat"


class ExtractMentionsResponse(BaseModel):
    # Kept as str (not shared.contracts.OrderIntent) on purpose: TDD §2.3's
    # hard constraint is zero egress beyond returning output to the caller,
    # and this keeps the extraction service's only dependency being this
    # module, not shared.contracts as well.
    intent: str
    intent_confidence: float = Field(default=0.95, ge=0.0, le=1.0)
    language_detected: list[str] = Field(default_factory=lambda: ["ur", "en"])
    mentions: list[ItemMention]


# --- 4.3: Mentions -> RAG Candidate Retrieval ---


class RAGCandidate(BaseModel):
    product_id: str
    matched_name: str
    unit: str
    price: float
    in_stock_qty: float
    similarity_score: float = Field(ge=0, le=1)


class RAGCandidatesRequest(BaseModel):
    store_id: str
    mentions: list[ItemMention]


class RAGCandidatesResponse(BaseModel):
    candidates: dict[str, list[RAGCandidate]]  # raw_mention -> candidates
    unmatched: list[str]  # below the similarity floor (TDD §4.3) — never reaches the LLM


# --- 4.4: Mentions + Candidates -> LLM (single call) ---


class AmbiguousItem(BaseModel):
    raw_mention: str
    options: list[str]


class GroundAndAssembleRequest(BaseModel):
    session_id: str
    intent: str
    mentions: list[ItemMention]
    candidates: dict[str, list[RAGCandidate]]
    # TDD §2.5 Input row: "{mentions, rag_candidates, session_context}".
    # FA §2.2: the call itself is stateless — session_context is read from
    # Redis by the caller and passed in here, not fetched by this service.
    session_context: SessionState


class GroundAndAssembleResponse(BaseModel):
    draft_order: OrderJSON
    ambiguous_items: list[AmbiguousItem]
    not_found_items: list[str]


# --- Phase 2: Pydantic Validation Gate + Confirmation Turn (TDD §2.6, §4.4-§4.5) ---
#
# Two steps, matching TDD §4.4's own sequencing ("The draft order is then
# run through the Pydantic gate (§2.6) before being written back to
# session state... Any item in ambiguous_items or not_found_items blocks
# confirmation for that line until resolved by the customer"):
#
#   1. validate-order: runs right after grounding, on every turn, whether
#      or not ambiguous/not_found items are present. Re-checks every
#      product_id already IN draft_order.line_items against the live
#      catalog (existence, is_active, unit match) -- this is the anti-
#      hallucination gate (TDD §2.6). It does not know or care about
#      ambiguous_items/not_found_items; those are a separate, upstream
#      concern already produced by grounding.
#   2. confirm-order: only called once the confirmation turn has nothing
#      left to block on (no ambiguous_items, no not_found_items, no
#      rejected_lines) and the customer's turn intent is CONFIRM. Stamps
#      order_id/confirmed/confirmed_at/total_amount and HMAC-signs into
#      the one artifact fulfillment-half consumes (Plan §1.1).


class RejectedLine(BaseModel):
    line_id: str
    raw_mention: str
    reason: str  # "product_id_not_found" | "product_inactive" | "unit_mismatch"
    detail: str  # human-readable, feeds the reprompt (TDD §2.6 "why")


class ValidateDraftOrderRequest(BaseModel):
    store_id: str
    draft_order: OrderJSON
    # Passed straight through from GroundAndAssembleResponse (§4.4) so the
    # confirmation turn can decide readiness in one place rather than the
    # caller re-deriving "is this order confirmable" from two responses.
    ambiguous_items: list[AmbiguousItem] = []
    not_found_items: list[str] = []


class ConfirmationTurnOutcome(str, Enum):
    BLOCKED_UNRESOLVED_ITEMS = "blocked_unresolved_items"  # ambiguous/not-found still open
    BLOCKED_GATE_REJECTED = "blocked_gate_rejected"  # Pydantic gate rejected >=1 line
    READY_TO_CONFIRM = "ready_to_confirm"  # gate-accepted, awaiting customer CONFIRM intent


class ValidateDraftOrderResponse(BaseModel):
    outcome: ConfirmationTurnOutcome
    # Re-priced from the live catalog at validation time (never trusts the
    # upstream unit_price) -- present only when outcome is READY_TO_CONFIRM.
    validated_order: OrderJSON | None = None
    rejected_lines: list[RejectedLine] = []
    # Customer-facing text the dialogue manager plays back verbatim
    # (TDD §2.6 example: "Sunlight soap 1kg — not found, did you mean
    # 500g?"), populated whenever outcome != READY_TO_CONFIRM.
    reprompt: str | None = None


class ConfirmOrderRequest(BaseModel):
    # Must be a validated_order previously returned with
    # outcome == READY_TO_CONFIRM; this endpoint does not re-run the gate
    # (that already happened) but does re-verify line_items are non-empty
    # and confirmed is still False, since a confirmed order is not
    # re-confirmable.
    validated_order: OrderJSON


class ConfirmOrderResponse(BaseModel):
    confirmed_order: ConfirmedOrder
