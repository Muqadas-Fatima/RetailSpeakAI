"""
TDD §2.5 — the only point in the pipeline where the LLM is invoked.
Given mentions + RAG candidates + session context, picks a product_id
per mention from the candidates only, decides whether to ask a
clarifying question, and assembles the draft Order JSON.

Hard constraint (TDD §2.5): "cannot introduce a product_id absent from
the candidate set." In production this is enforced structurally — the
LLM's tool schema types product_id as an enum of the specific candidate
IDs passed in for that call, not an open string field. This module has
no LLM call to constrain (it's the Phase 1 mock), so the equivalent
guarantee is enforced by construction instead: every line item this
code ever emits is built directly from a RAGCandidate object already in
the request, never from a free-formed/parsed string. There is no code
path here that can fabricate a product_id — the confirming unit test in
tests/pipeline/ checks exactly this.

Phase 1 (Execution Plan §4): scaffolded first as a typed contract with
a MOCKED implementation. Real tech is Qwen-2.5-7B-Instruct via vLLM
(fallback: Groq LLaMA-3.1-8B). MockRuleBasedGrounder implements the
confidence-band behavior (TDD §2.5, §6.3) deterministically — that
banding is specified pipeline behavior the real LLM is instructed to
follow, not the real model's own discretion, so a rule-based mock is a
faithful stand-in for wiring/testing purposes. Swap it out without
changing LLMGrounder's interface.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import datetime, timezone
from uuid import UUID

from contracts.pipeline_io import AmbiguousItem, GroundAndAssembleRequest, GroundAndAssembleResponse
from shared.contracts.order import OrderIntent, OrderJSON, OrderLineItem


class LLMGrounder(ABC):
    @abstractmethod
    def ground_and_assemble(self, request: GroundAndAssembleRequest) -> GroundAndAssembleResponse: ...


class MockRuleBasedGrounder(LLMGrounder):
    def ground_and_assemble(self, request: GroundAndAssembleRequest) -> GroundAndAssembleResponse:
        line_items: list[OrderLineItem] = []
        ambiguous_items: list[AmbiguousItem] = []
        not_found_items: list[str] = []

        for index, mention in enumerate(request.mentions):
            mention_candidates = request.candidates.get(mention.raw_mention, [])

            if not mention_candidates:
                # TDD §6.3 step 4: nothing reaches "the LLM" for this
                # mention as a non-empty candidate list — relayed as
                # not-found, never silently substituted.
                not_found_items.append(mention.raw_mention)
                continue

            if len(mention_candidates) > 1:
                # TDD §2.5 confidence-driven behavior: multiple close
                # candidates -> disambiguation question, blocks
                # confirmation for that line. No line item is added.
                ambiguous_items.append(
                    AmbiguousItem(
                        raw_mention=mention.raw_mention,
                        options=[c.matched_name for c in mention_candidates],
                    )
                )
                continue

            # Exactly one candidate: RAG already applied the auto-accept
            # truncation (TDD §6.3 step 3), so this is the "obvious match,
            # no question" path.
            candidate = mention_candidates[0]
            line_items.append(
                OrderLineItem(
                    line_id=mention.refers_to_line_id or f"l{index + 1}",
                    product_id=UUID(candidate.product_id),
                    matched_name=candidate.matched_name,
                    raw_mention=mention.raw_mention,
                    quantity=mention.quantity_hint or 1,
                    unit=candidate.unit,
                    unit_price=candidate.price,
                    confidence=candidate.similarity_score,
                )
            )

        draft_order = OrderJSON(
            session_id=UUID(request.session_id),
            store_id=UUID(request.session_context.store_id),
            customer_id=(
                UUID(request.session_context.customer_id)
                if request.session_context.customer_id
                else None
            ),
            language_mix=request.session_context.language_state or ["ur"],
            intent=(
                OrderIntent(request.intent)
                if request.intent in OrderIntent._value2member_map_
                else OrderIntent.ADD_ITEM
            ),
            line_items=line_items,
            payment_method=None,
            confirmed=False,
            created_at=datetime.now(timezone.utc),
        )

        return GroundAndAssembleResponse(
            draft_order=draft_order,
            ambiguous_items=ambiguous_items,
            not_found_items=not_found_items,
        )
