"""
Phase 1 exit criteria (Execution Plan §4, Phase 1):
"the pipeline produces a draft Order JSON from a mocked catalog,
entirely independent of any fulfillment-side code."

This test wires nlu-extraction-service -> rag-retrieval-service ->
llm-grounding-service directly (no HTTP layer — the FastAPI api.py
files are thin wrappers around exactly these same calls) and asserts
the result reproduces the TDD's own worked examples:
  - "do kilo chawal aur ek dozen anda" -> §4.2's mention extraction,
    "chawal" auto-accepts to Basmati Rice at a high score (§4.3's own
    example uses 0.88; this mock's exact-match scoring gives 1.0,
    which is a stronger version of the same auto-accept case).
  - "ghee tin" has no catalog match -> not_found_items (§4.4's example).
  - A mention landing two rice products in the 0.72-0.85 band ->
    ambiguous_items, no line item added for it (§6.3 disambiguation).

Run: pip install -r requirements.txt && pytest tests/pipeline/ -v
"""

from __future__ import annotations

import os
import sys

_REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
_NLU_HALF = os.path.join(_REPO_ROOT, "nlu-half")

for path in (
    _REPO_ROOT,  # `shared.*`
    _NLU_HALF,  # `contracts.*`
    os.path.join(_NLU_HALF, "nlu-extraction-service"),  # `extractor`
    os.path.join(_NLU_HALF, "rag-retrieval-service"),  # `retriever`, `mock_catalog`
    os.path.join(_NLU_HALF, "llm-grounding-service"),  # `grounder`
):
    if path not in sys.path:
        sys.path.insert(0, path)

from contracts.pipeline_io import ExtractMentionsRequest, RAGCandidatesRequest, GroundAndAssembleRequest
from extractor import MockRuleBasedExtractor
from retriever import MockSimilarityRetriever
from grounder import MockRuleBasedGrounder
from mock_catalog import DEFAULT_STORE_ID
from shared.config.session import SessionState
from shared.config.store_config import StoreConfig


STORE_ID = str(DEFAULT_STORE_ID)


def run_pipeline(input_text: str, session_id: str = "22222222-2222-2222-2222-222222222222"):
    """Runs all three Phase 1 services back to back, exactly as api.py's three
    endpoints would if called in sequence over HTTP."""
    extractor = MockRuleBasedExtractor()
    retriever = MockSimilarityRetriever()
    grounder = MockRuleBasedGrounder()
    store_config = StoreConfig(store_id=STORE_ID)

    extraction = extractor.extract_mentions(
        ExtractMentionsRequest(
            session_id=session_id, store_id=STORE_ID, input_text=input_text, channel="voice"
        )
    )

    rag_response = retriever.get_candidates(
        RAGCandidatesRequest(store_id=STORE_ID, mentions=extraction.mentions), store_config
    )

    grounding = grounder.ground_and_assemble(
        GroundAndAssembleRequest(
            session_id=session_id,
            intent=extraction.intent,
            mentions=extraction.mentions,
            candidates=rag_response.candidates,
            session_context=SessionState(store_id=STORE_ID),
        )
    )
    return extraction, rag_response, grounding


class TestPhase1MockedPipelineProducesDraftOrder:
    def test_tdd_worked_example_end_to_end(self):
        # TDD §4.2's own example utterance.
        _, _, grounding = run_pipeline("do kilo chawal aur ek dozen anda")

        assert len(grounding.draft_order.line_items) == 2
        names = {li.matched_name for li in grounding.draft_order.line_items}
        assert names == {"Basmati Rice", "Eggs"}

        rice_line = next(li for li in grounding.draft_order.line_items if li.matched_name == "Basmati Rice")
        assert rice_line.quantity == 2
        assert rice_line.unit == "kg"

        egg_line = next(li for li in grounding.draft_order.line_items if li.matched_name == "Eggs")
        # "ek dozen" -> 1 * 12 (TDD §4.2 worked example: quantity_hint 12, unit_hint "pcs")
        assert egg_line.quantity == 12
        assert egg_line.unit == "pcs"

        assert grounding.not_found_items == []
        assert grounding.ambiguous_items == []

    def test_not_found_item_never_becomes_a_line_item(self):
        # TDD §4.4's own example: "ghee tin" has no catalog match.
        _, rag_response, grounding = run_pipeline("mujhe ghee tin chahiye")

        assert any("ghee" in m for m in rag_response.unmatched)
        assert grounding.not_found_items
        assert grounding.draft_order.line_items == []

    def test_disambiguation_band_blocks_confirmation_for_that_line(self):
        # "achi chawal" lands both rice products in the 0.72-0.85 band.
        _, rag_response, grounding = run_pipeline("achi chawal")

        assert len(rag_response.candidates["achi chawal"]) >= 2
        assert grounding.ambiguous_items
        ambiguous = grounding.ambiguous_items[0]
        assert ambiguous.raw_mention == "achi chawal"
        assert "Basmati Rice" in ambiguous.options
        assert "Sella Rice" in ambiguous.options
        # No line item was silently added for the ambiguous mention.
        assert grounding.draft_order.line_items == []

    def test_grounder_never_selects_a_product_id_outside_the_given_candidates(self):
        # TDD §2.5 hard constraint, checked directly rather than just
        # trusted by construction: every emitted product_id must trace
        # back to a candidate that was actually offered for that mention.
        _, rag_response, grounding = run_pipeline("do kilo chawal aur ek dozen anda")

        offered_ids = {
            c.product_id
            for candidates in rag_response.candidates.values()
            for c in candidates
        }
        for line in grounding.draft_order.line_items:
            assert str(line.product_id) in offered_ids

    def test_multi_product_ata_and_olpers_milk_end_to_end(self):
        # User explicitly requested scenario: "1 kilo ata, 2 olpher milk"
        extraction, rag_response, grounding = run_pipeline("1 kilo ata, 2 olpher milk")

        assert len(extraction.mentions) == 2
        assert len(grounding.draft_order.line_items) == 2

        names = {li.matched_name for li in grounding.draft_order.line_items}
        assert "Chakki Atta 1kg" in names
        assert "Olper's Milk 1L" in names

        atta_line = next(li for li in grounding.draft_order.line_items if li.matched_name == "Chakki Atta 1kg")
        assert atta_line.quantity == 1
        assert atta_line.unit == "kg"

        milk_line = next(li for li in grounding.draft_order.line_items if li.matched_name == "Olper's Milk 1L")
        assert milk_line.quantity == 2
        assert milk_line.unit == "litre"

    def test_quantity_separation_two_one_liter_bottles_of_sprite(self):
        # Customer Complaint #5: "two 1-liter bottles of Sprite" -> 2 bottles, NOT 21 liters!
        extraction, rag_response, grounding = run_pipeline("two 1-liter bottles of Sprite")

        assert len(extraction.mentions) == 1
        assert extraction.mentions[0].quantity_hint == 2
        assert extraction.mentions[0].unit_hint == "bottle"
        assert extraction.mentions[0].size_or_volume == "1-liter"

        assert len(grounding.draft_order.line_items) == 1
        sprite_line = grounding.draft_order.line_items[0]
        assert sprite_line.matched_name == "Sprite 1L"
        assert sprite_line.quantity == 2  # NOT 21!
        assert sprite_line.unit == "bottle"

    def test_brand_with_number_7up_not_treated_as_quantity(self):
        # Customer Complaint #5: "7UP" -> brand 7UP, not 7 regular sodas!
        _, _, grounding1 = run_pipeline("7UP")
        assert len(grounding1.draft_order.line_items) == 1
        line1 = grounding1.draft_order.line_items[0]
        assert line1.matched_name == "7UP 500ml"
        assert line1.quantity == 1  # NOT 7!

        _, _, grounding2 = run_pipeline("2 7UP")
        assert len(grounding2.draft_order.line_items) == 1
        line2 = grounding2.draft_order.line_items[0]
        assert line2.matched_name == "7UP 500ml"
        assert line2.quantity == 2

    def test_human_fallback_intent_operator(self):
        # Customer Complaint #6: "The 'No Human Fallback' Trap"
        extraction, _, _ = run_pipeline("operator please, talk to human")
        assert extraction.intent == "human_fallback"
        assert extraction.mentions == []

    def test_mid_sentence_correction_handles_mind_change(self):
        # Customer Complaint #2: "Wait, make that a ... instead"
        _, _, grounding = run_pipeline("do olper milk nahi ek olper milk kar do")
        assert len(grounding.draft_order.line_items) == 1
        milk_line = grounding.draft_order.line_items[0]
        assert milk_line.matched_name == "Olper's Milk 1L"
        assert milk_line.quantity == 1  # successfully corrected from 2 to 1!

    def test_pipeline_has_no_dependency_on_fulfillment_half(self):
        import ast

        this_dir = os.path.dirname(os.path.abspath(__file__))
        service_files = [
            os.path.join(_NLU_HALF, "nlu-extraction-service", "extractor.py"),
            os.path.join(_NLU_HALF, "rag-retrieval-service", "retriever.py"),
            os.path.join(_NLU_HALF, "rag-retrieval-service", "mock_catalog.py"),
            os.path.join(_NLU_HALF, "llm-grounding-service", "grounder.py"),
        ]
        for path in service_files:
            with open(path, encoding="utf-8") as f:
                tree = ast.parse(f.read(), filename=path)
            for node in ast.walk(tree):
                if isinstance(node, ast.Import):
                    for alias in node.names:
                        assert "fulfillment" not in alias.name, f"{path} imports {alias.name}"
                elif isinstance(node, ast.ImportFrom) and node.module:
                    assert "fulfillment" not in node.module, f"{path} imports {node.module}"
