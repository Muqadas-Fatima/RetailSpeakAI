"""
RAG Retrieval Layer — TDD §2.4. Embeds each item mention with
BGE-Small-EN-v1.5 and retrieves the closest real catalog products via
pgvector cosine distance, scoped to the requesting store. This is the
layer that makes hallucination structurally impossible: anything below
the similarity floor is never surfaced as a candidate at all, so the LLM
layer downstream can never be handed (or pick) a fabricated product.

Threshold semantics (TDD §2.4, §6.1):
  similarity_score < rag_similarity_floor (0.72 default) -> not a candidate
  the raw score is always passed through unmodified for every surfaced
  candidate, so the LLM can apply its own confidence-driven behavior.
"""
import uuid

from sentence_transformers import SentenceTransformer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.db_models import Product, Store
from app.schemas.nlu import MentionSpan
from app.schemas.rag import RagCandidate, RagCandidatesResponse

settings = get_settings()

# Loaded once per worker process; BGE-Small is ~130MB, cheap to keep resident.
_embedding_model: SentenceTransformer | None = None


def get_embedding_model() -> SentenceTransformer:
    global _embedding_model
    if _embedding_model is None:
        _embedding_model = SentenceTransformer(settings.embedding_model_name)
    return _embedding_model


def build_embedding_text(product: Product) -> str:
    """Concatenate every bilingual/alias field so retrieval matches
    regardless of which language/script the customer used."""
    parts = [product.name_en]
    if product.name_ur:
        parts.append(product.name_ur)
    if product.name_roman_ur:
        parts.append(product.name_roman_ur)
    if product.aliases:
        parts.append(product.aliases)
    return " | ".join(parts)


def embed_text(text: str) -> list[float]:
    model = get_embedding_model()
    vec = model.encode(text, normalize_embeddings=True)
    return vec.tolist()


async def _get_store_thresholds(db: AsyncSession, store_id: uuid.UUID) -> tuple[float, float]:
    """Per-store tunable thresholds, falling back to process defaults —
    Foundation Plan §10: thresholds must be a tunable config value, not a
    hardcoded constant, since they're expected to shift after field data."""
    store = await db.get(Store, store_id)
    floor = float(store.rag_similarity_floor) if store and store.rag_similarity_floor is not None else settings.rag_similarity_floor
    auto_accept = (
        float(store.rag_auto_accept_threshold)
        if store and store.rag_auto_accept_threshold is not None
        else settings.rag_auto_accept_threshold
    )
    return floor, auto_accept


async def retrieve_candidates(
    db: AsyncSession, store_id: uuid.UUID, mentions: list[MentionSpan]
) -> RagCandidatesResponse:
    floor, _auto_accept = await _get_store_thresholds(db, store_id)

    candidates: dict[str, list[RagCandidate]] = {}
    unmatched: list[str] = []

    for mention in mentions:
        query_vec = embed_text(mention.raw_mention)

        # cosine_distance = 1 - cosine_similarity for a normalized vector;
        # pgvector's `<=>` operator returns cosine distance directly.
        stmt = (
            select(
                Product,
                Product.embedding.cosine_distance(query_vec).label("distance"),
            )
            .where(Product.store_id == store_id, Product.is_active.is_(True))
            .order_by("distance")
            .limit(settings.rag_top_k)
        )
        result = await db.execute(stmt)
        rows = result.all()

        mention_candidates: list[RagCandidate] = []
        for product, distance in rows:
            similarity_score = round(1.0 - float(distance), 4)
            if similarity_score < floor:
                continue  # TDD §2.4: below floor -> not a candidate at all
            mention_candidates.append(
                RagCandidate(
                    product_id=product.product_id,
                    matched_name=product.name_en,
                    unit=product.unit,
                    price=float(product.price),
                    in_stock_qty=float(product.in_stock_qty),
                    max_order_qty=float(product.max_order_qty) if product.max_order_qty is not None else None,
                    similarity_score=similarity_score,
                )
            )

        if mention_candidates:
            candidates[mention.raw_mention] = mention_candidates
        else:
            unmatched.append(mention.raw_mention)

    return RagCandidatesResponse(candidates=candidates, unmatched=unmatched)


async def reindex_product(db: AsyncSession, product: Product) -> None:
    """Call after any catalog insert/update so the embedding stays in
    sync — Foundation Plan §10 notes new-store catalog loads "already
    trigger re-embedding" via this same insert path."""
    product.embedding = embed_text(build_embedding_text(product))
    db.add(product)
    await db.flush()
