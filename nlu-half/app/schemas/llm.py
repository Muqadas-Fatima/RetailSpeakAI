"""
LLM grounding contracts — TDD §2.5, §4.4. The single call that turns
(mentions + scored candidates) into a draft Order JSON, or a clarification
question. product_id here is only ever populated from candidate sets that
RAG already proved are real (enforced structurally in llm_grounding_service
via a constrained tool schema, TDD §2.5 hard constraint).
"""
import uuid

from pydantic import BaseModel, Field

from app.schemas.order import DraftOrderJSON
from app.schemas.rag import RagCandidate


class GroundAndAssembleRequest(BaseModel):
    session_id: str
    store_id: uuid.UUID
    customer_id: uuid.UUID | None = None
    channel: str
    intent: str
    mentions: list[dict] = Field(default_factory=list)  # MentionSpan.model_dump()
    candidates: dict[str, list[RagCandidate]] = Field(default_factory=dict)
    language_mix: list[str] = Field(default_factory=list)


class AmbiguousItem(BaseModel):
    raw_mention: str
    options: list[str]  # human-readable candidate names, e.g. "Basmati Rice 1kg"
    option_product_ids: list[uuid.UUID]


class GroundAndAssembleResponse(BaseModel):
    session_id: str
    draft_order: DraftOrderJSON
    ambiguous_items: list[AmbiguousItem] = Field(default_factory=list)
    not_found_items: list[str] = Field(default_factory=list)

    @property
    def blocks_confirmation(self) -> bool:
        """TDD §4.4: any item in ambiguous_items or not_found_items blocks
        confirmation for that line until resolved by the customer."""
        return bool(self.ambiguous_items or self.not_found_items)
