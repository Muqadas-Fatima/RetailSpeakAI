"""
NLU extraction contracts — TDD §2.3 (non-LLM mention/qty/unit extraction)
and §4.2 (POST /v1/nlu/extract-mentions). This layer is catalog-free by
hard constraint: it never resolves a mention to a real product_id.
"""
from __future__ import annotations

import uuid
from enum import Enum
from pydantic import BaseModel, ConfigDict, Field


class Channel(str, Enum):
    VOICE = "voice"
    CHAT = "chat"


class MentionSpan(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    raw_mention: str
    product_name: str | None = None
    brand: str | None = None
    quantity_hint: float | None = None
    unit_hint: str | None = None
    size_or_volume: str | None = None
    customizations: list[str] = Field(default_factory=list)
    item_intent: str = "add"  # "add" | "modify" | "remove"
    confidence: float = Field(default=0.90, ge=0.0, le=1.0)
    refers_to_line_id: str | None = None  # set when intent is modify/remove


class ExtractMentionsRequest(BaseModel):
    session_id: str
    store_id: uuid.UUID
    input_text: str = Field(min_length=1, max_length=2000)
    channel: Channel


class ExtractMentionsResponse(BaseModel):
    session_id: str
    intent: str  # OrderIntent value or "human_fallback"
    intent_confidence: float = Field(default=0.95, ge=0.0, le=1.0)
    language_detected: list[str] = Field(default_factory=lambda: ["ur", "en"])
    mentions: list[MentionSpan] = Field(default_factory=list)
