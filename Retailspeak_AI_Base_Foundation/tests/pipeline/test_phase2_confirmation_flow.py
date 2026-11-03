"""
Phase 2 exit criteria (Execution Plan §4, Phase 2):
"this phase produces the one artifact fulfillment consumes -- it is the
gating dependency for Phase 3."

Extends tests/pipeline/test_phase1_mocked_pipeline.py's wiring one step
further: nlu-extraction -> rag-retrieval -> llm-grounding (Phase 1) ->
validate-order -> confirm-order (Phase 2), and asserts the end state is
a HMAC-verifiable ConfirmedOrder -- or, for the ambiguous/not-found
utterances Phase 1's own tests already exercise, a blocked outcome with
no signature ever produced.
"""

from __future__ import annotations

import os
import sys

_REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
_NLU_HALF = os.path.join(_REPO_ROOT, "nlu-half")

for path in (
    _REPO_ROOT,
    _NLU_HALF,
    os.path.join(_NLU_HALF, "nlu-extraction-service"),
    os.path.join(_NLU_HALF, "rag-retrieval-service"),
    os.path.join(_NLU_HALF, "llm-grounding-service"),
    os.path.join(_NLU_HALF, "validation-gate"),
):
    if path not in sys.path:
        sys.path.insert(0, path)

from confirmation import ConfirmationTurn
from contracts.pipeline_io import (
    ConfirmationTurnOutcome,
    ExtractMentionsRequest,
    GroundAndAssembleRequest,
    RAGCandidatesRequest,
    ValidateDraftOrderRequest,
)
from extractor import MockRuleBasedExtractor
from gate import MockCatalogLookup, PydanticValidationGate
from grounder import MockRuleBasedGrounder
from mock_catalog import DEFAULT_STORE_ID, MockCatalogStore
from retriever import MockSimilarityRetriever
from shared.config.session import SessionState
from shared.config.store_config import StoreConfig
from signer import HMACOrderSigner

STORE_ID = str(DEFAULT_STORE_ID)
SESSION_ID = "22222222-2222-2222-2222-222222222222"


def run_full_pipeline(input_text: str):
    extractor = MockRuleBasedExtractor()
    retriever = MockSimilarityRetriever()
    grounder = MockRuleBasedGrounder()
    store_config = StoreConfig(store_id=STORE_ID)

    extraction = extractor.extract_mentions(
        ExtractMentionsRequest(session_id=SESSION_ID, store_id=STORE_ID, input_text=input_text, channel="voice")
    )
    rag_response = retriever.get_candidates(
        RAGCandidatesRequest(store_id=STORE_ID, mentions=extraction.mentions), store_config
    )
    grounding = grounder.ground_and_assemble(
        GroundAndAssembleRequest(
            session_id=SESSION_ID,
            intent=extraction.intent,
            mentions=extraction.mentions,
            candidates=rag_response.candidates,
            session_context=SessionState(store_id=STORE_ID),
        )
    )

    confirmation_turn = ConfirmationTurn(
        gate=PydanticValidationGate(catalog=MockCatalogLookup(MockCatalogStore()))
    )
    validation = confirmation_turn.evaluate(
        ValidateDraftOrderRequest(
            store_id=STORE_ID,
            draft_order=grounding.draft_order,
            ambiguous_items=grounding.ambiguous_items,
            not_found_items=grounding.not_found_items,
        )
    )
    return grounding, validation


class TestPhase2ConfirmationFlowProducesSignedOrder:
    def test_clean_order_reaches_ready_to_confirm_and_signs(self):
        _, validation = run_full_pipeline("do kilo chawal aur ek dozen anda")

        assert validation.outcome == ConfirmationTurnOutcome.READY_TO_CONFIRM
        assert validation.validated_order is not None
        assert validation.rejected_lines == []

        signer = HMACOrderSigner(secret_key=b"test-secret")
        confirmed = signer.sign_and_stamp(validation.validated_order)

        assert confirmed.confirmed is True
        assert confirmed.order_id is not None
        assert confirmed.total_amount > 0
        assert signer.verify(confirmed) is True

    def test_not_found_item_blocks_confirmation_before_the_gate_even_runs(self):
        # TDD §4.4: not_found_items blocks confirmation for that line --
        # no ConfirmedOrder is ever produced, and no signature exists to
        # tamper with in the first place.
        _, validation = run_full_pipeline("mujhe ghee tin chahiye")

        assert validation.outcome == ConfirmationTurnOutcome.BLOCKED_UNRESOLVED_ITEMS
        assert validation.validated_order is None
        assert "not found" in validation.reprompt

    def test_ambiguous_item_blocks_confirmation_with_a_disambiguation_reprompt(self):
        _, validation = run_full_pipeline("achi chawal")

        assert validation.outcome == ConfirmationTurnOutcome.BLOCKED_UNRESOLVED_ITEMS
        assert validation.validated_order is None
        assert "Basmati Rice" in validation.reprompt
        assert "Sella Rice" in validation.reprompt

    def test_signer_refuses_to_sign_a_blocked_turns_order(self):
        # Defense in depth: even if a caller mistakenly tried to sign the
        # (empty-line-items) draft_order from a blocked turn directly
        # rather than a READY_TO_CONFIRM validated_order, the signer's
        # own empty-line-items guard (Plan §1.3: every boundary
        # re-validates) still stops it.
        grounding, _ = run_full_pipeline("mujhe ghee tin chahiye")
        signer = HMACOrderSigner(secret_key=b"test-secret")

        try:
            signer.sign_and_stamp(grounding.draft_order)
            assert False, "expected ValueError"
        except ValueError:
            pass
