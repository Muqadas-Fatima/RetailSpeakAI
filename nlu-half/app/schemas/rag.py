"""
RAG retrieval contracts — TDD §2.4, §4.3. The similarity_score is always
passed through raw (never collapsed to a pass/fail flag) so the LLM layer
can make confidence-driven decisions per TDD §2.5.
"""
import uuid

from pydantic import BaseModel, Field

from app.schemas.nlu import MentionSpan


class RagCandidatesRequest(BaseModel):
    store_id: uuid.UUID
    mentions: list[MentionSpan]


class RagCandidate(BaseModel):
    product_id: uuid.UUID
    matched_name: str
    unit: str
    price: float
    in_stock_qty: float
    max_order_qty: float | None = None
    similarity_score: float = Field(ge=0.0, le=1.0)


class RagCandidatesResponse(BaseModel):
    candidates: dict[str, list[RagCandidate]] = Field(default_factory=dict)
    # Mentions whose best match fell below the similarity floor — TDD §2.4:
    # "item is NOT returned as a candidate; LLM must respond with
    # 'not found,' not a low-confidence guess."
    unmatched: list[str] = Field(default_factory=list)
