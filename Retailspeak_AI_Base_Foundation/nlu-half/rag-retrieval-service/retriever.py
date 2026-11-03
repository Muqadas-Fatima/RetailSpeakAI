"""
TDD §2.4, §6.1–§6.3 — RAG retrieval: given raw item mentions, return the
closest real catalog product(s) per store with a similarity score each,
so the LLM has a bounded, real, scored set to reason over. This is the
layer that makes hallucination structurally impossible (TDD §2.4).

Phase 1 (Execution Plan §4): scaffolded first as a typed contract with a
MOCKED implementation. Real tech is BGE-Small-EN-v1.5 embeddings over
Supabase pgvector (TDD §2.4, §6.1) with an ivfflat cosine-distance index,
read-through-cached in Redis (TDD §10.3). MockSimilarityRetriever stands
in with a cheap stdlib string-similarity heuristic — swap it for a real
embedding index without changing RAGRetriever's interface.

Threshold/truncation logic (TDD §6.3, implemented here since §2.4's
"Threshold" row places this behavior on the RAG layer, not the LLM):
  score >= auto_accept_threshold (0.85 default) -> only that single
      top candidate is passed forward.
  disambiguation_floor <= score < auto_accept_threshold (0.72-0.85) ->
      top up to 3 candidates passed forward.
  score < disambiguation_floor for every candidate -> mention goes to
      `unmatched`; nothing is ever passed to the LLM for it.
Thresholds come from StoreConfig (shared/config/store_config.py), not
hardcoded — Plan §6 open decision.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from difflib import SequenceMatcher
from uuid import UUID

from contracts.pipeline_io import RAGCandidate, RAGCandidatesRequest, RAGCandidatesResponse
from mock_catalog import MockCatalogStore
from shared.config.store_config import StoreConfig
from shared.contracts.catalog import Product

_MAX_DISAMBIGUATION_CANDIDATES = 3


class RAGRetriever(ABC):
    @abstractmethod
    def get_candidates(
        self, request: RAGCandidatesRequest, store_config: StoreConfig
    ) -> RAGCandidatesResponse: ...


def _name_fields(product: Product) -> list[str]:
    return [product.name_en, product.name_ur, product.name_roman_ur, *product.aliases]


def _mock_similarity(mention: str | Any, product: Product) -> float:
    """
    Stand-in for BGE-Small cosine similarity: best SequenceMatcher ratio
    across the product's name/alias fields (TDD §6.1).
    """
    raw = mention.raw_mention if hasattr(mention, "raw_mention") else str(mention)
    mention_lower = raw.strip().lower()
    return max(
        (SequenceMatcher(None, mention_lower, field.strip().lower()).ratio() for field in _name_fields(product)),
        default=0.0,
    )


class MockSimilarityRetriever(RAGRetriever):
    def __init__(self, catalog: MockCatalogStore | None = None):
        self._catalog = catalog or MockCatalogStore()

    def get_candidates(
        self, request: RAGCandidatesRequest, store_config: StoreConfig
    ) -> RAGCandidatesResponse:
        store_id = UUID(request.store_id)
        products = self._catalog.active_products_for_store(store_id)

        candidates: dict[str, list[RAGCandidate]] = {}
        unmatched: list[str] = []

        for mention in request.mentions:
            scored = sorted(
                (
                    (product, _mock_similarity(mention, product))
                    for product in products
                ),
                key=lambda pair: pair[1],
                reverse=True,
            )
            above_floor = [
                (p, s) for p, s in scored if s >= store_config.rag_disambiguation_floor
            ]

            if not above_floor:
                unmatched.append(mention.raw_mention)
                continue

            top_product, top_score = above_floor[0]
            if top_score >= store_config.rag_auto_accept_threshold:
                kept = above_floor[:1]  # TDD §6.3 step 3: only the obvious match passed forward
            else:
                kept = above_floor[:_MAX_DISAMBIGUATION_CANDIDATES]

            candidates[mention.raw_mention] = [
                RAGCandidate(
                    product_id=str(p.product_id),
                    matched_name=p.name_en,
                    unit=p.unit,
                    price=p.price,
                    in_stock_qty=p.in_stock_qty,
                    similarity_score=round(s, 4),
                )
                for p, s in kept
            ]

        return RAGCandidatesResponse(candidates=candidates, unmatched=unmatched)
