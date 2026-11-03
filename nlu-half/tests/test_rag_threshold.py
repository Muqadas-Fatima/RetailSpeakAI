"""
RAG threshold tests — TDD §2.4: items whose best similarity score falls
below the floor (0.72 default) must never be surfaced as a candidate at
all, and land in `unmatched` instead.
"""
from unittest.mock import patch

import numpy as np
import pytest

from app.schemas.nlu import MentionSpan
from app.services import rag_service

pytestmark = pytest.mark.asyncio


def _fake_embed(text: str) -> list[float]:
    """Deterministic fake embeddings: a mention containing 'chawal' is
    close to the rice product's fixture embedding ([0.1]*384); anything
    else is far from every fixture vector so it falls below the floor."""
    if "chawal" in text.lower() or "rice" in text.lower():
        return [0.1] * 384
    return [-0.9] * 384


async def test_below_floor_mentions_land_in_unmatched(db_session, sample_store_and_products):
    store, products = sample_store_and_products

    with patch.object(rag_service, "embed_text", side_effect=_fake_embed):
        response = await rag_service.retrieve_candidates(
            db_session,
            store.store_id,
            [MentionSpan(raw_mention="ghee tin", quantity_hint=1, unit_hint=None)],
        )

    assert "ghee tin" in response.unmatched
    assert "ghee tin" not in response.candidates


async def test_above_floor_mentions_are_surfaced_with_raw_score(db_session, sample_store_and_products):
    store, products = sample_store_and_products

    with patch.object(rag_service, "embed_text", side_effect=_fake_embed):
        response = await rag_service.retrieve_candidates(
            db_session,
            store.store_id,
            [MentionSpan(raw_mention="do kilo chawal", quantity_hint=2, unit_hint="kg")],
        )

    assert "do kilo chawal" in response.candidates
    top = response.candidates["do kilo chawal"][0]
    assert top.similarity_score >= rag_service.settings.rag_similarity_floor
    assert 0.0 <= top.similarity_score <= 1.0


async def test_per_store_threshold_override_is_respected(db_session, sample_store_and_products):
    store, products = sample_store_and_products
    # Tighten this store's floor so high above default that even the "close" match fails.
    store.rag_similarity_floor = 0.999
    db_session.add(store)
    await db_session.commit()

    with patch.object(rag_service, "embed_text", side_effect=_fake_embed):
        response = await rag_service.retrieve_candidates(
            db_session,
            store.store_id,
            [MentionSpan(raw_mention="chawal", quantity_hint=1, unit_hint="kg")],
        )

    assert "chawal" in response.unmatched
