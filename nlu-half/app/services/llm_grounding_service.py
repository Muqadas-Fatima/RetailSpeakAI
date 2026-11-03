"""
LLM Layer — TDD §2.5, §4.4. The *only* point in the pipeline where the LLM
is invoked. Given mentions + RAG candidates (with raw similarity scores),
it decides per mention: select a real product_id, ask a clarifying
question, or report "not found" — then assembles the draft Order JSON.

Anti-hallucination design (TDD §2.5 hard constraint): the tool schema's
`product_id` field is a JSON-schema `enum` built from the *union of every
real candidate product_id* surfaced by RAG for this call — never a free
string. The model is architecturally unable to emit an ID that RAG didn't
surface. As defense-in-depth (belt-and-suspenders beyond the schema
constraint), this service also re-validates server-side that any selected
product_id belongs to *that specific mention's* own candidate set before
trusting it — a model could otherwise pick a real ID that just happens to
belong to a different mention in the same call.

Primary model: Qwen-2.5-7B-Instruct via vLLM's OpenAI-compatible endpoint
(TDD §2.5, §14). Fallback: Groq LLaMA-3.1-8B (TDD §2.5, §14), used when
the primary is unavailable.
"""
import json
from typing import Any

from groq import AsyncGroq
from openai import AsyncOpenAI

from app.config import get_settings
from app.core.exceptions import LlmGroundingUnavailable
from app.schemas.llm import AmbiguousItem, GroundAndAssembleRequest, GroundAndAssembleResponse
from app.schemas.order import DraftOrderJSON, OrderIntent, OrderLineItem
from app.schemas.rag import RagCandidate

settings = get_settings()

_primary_client = AsyncOpenAI(base_url=settings.llm_primary_base_url, api_key=settings.llm_primary_api_key)
_fallback_client = AsyncGroq(api_key=settings.llm_fallback_api_key)

_TOOL_NAME = "emit_order_json"

_SYSTEM_PROMPT = (
    "You are the order-grounding step of a Pakistani kiryana (grocery) store's "
    "voice/chat ordering assistant. You are given item mentions the customer made "
    "(in Urdu, English, or Roman Urdu) and, for each mention, a short list of REAL "
    "catalog products retrieved by search, each with a similarity_score.\n\n"
    "For each mention, you must decide exactly one of:\n"
    "  - 'select': pick the correct product_id from that mention's candidate list "
    "(use this when one candidate is a confident, unambiguous match — similarity_score >= 0.85, "
    "or clearly the only sensible match)\n"
    "  - 'clarify': when 2+ candidates are both plausible, or the top score is between 0.72 and 0.85 "
    "and you are not confident — write a short, natural clarification question in the SAME language mix "
    "the customer used\n"
    "  - 'not_found': when the mention has NO candidates at all\n\n"
    "You may ONLY select a product_id that appears in that mention's own candidate list. "
    "NEVER invent a product_id, name, price, or unit that was not given to you. "
    "Preserve the customer's requested quantity unless they clearly stated a correction."
)


def _build_tool_schema(candidates: dict[str, list[RagCandidate]]) -> dict[str, Any]:
    all_ids = sorted({str(c.product_id) for cands in candidates.values() for c in cands})
    # An empty enum is invalid JSON schema, so guarantee at least a
    # placeholder the model can never legitimately choose but that keeps
    # the schema well-formed when every mention is unmatched.
    id_enum = all_ids or ["__no_candidates__"]

    return {
        "type": "function",
        "function": {
            "name": _TOOL_NAME,
            "description": "Emit the grounded decision for every item mention in this turn.",
            "parameters": {
                "type": "object",
                "properties": {
                    "lines": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "raw_mention": {"type": "string"},
                                "decision": {"type": "string", "enum": ["select", "clarify", "not_found"]},
                                "product_id": {
                                    "type": ["string", "null"],
                                    "enum": id_enum + [None],
                                },
                                "quantity": {"type": ["number", "null"]},
                                "clarification_question": {"type": ["string", "null"]},
                            },
                            "required": ["raw_mention", "decision"],
                        },
                    }
                },
                "required": ["lines"],
            },
        },
    }


def _candidates_to_prompt_json(candidates: dict[str, list[RagCandidate]]) -> str:
    return json.dumps(
        {
            mention: [c.model_dump(mode="json") for c in cands]
            for mention, cands in candidates.items()
        },
        ensure_ascii=False,
    )


async def _call_primary(messages: list[dict], tool_schema: dict) -> dict:
    resp = await _primary_client.chat.completions.create(
        model=settings.llm_primary_model,
        messages=messages,
        tools=[tool_schema],
        tool_choice={"type": "function", "function": {"name": _TOOL_NAME}},
        temperature=0.1,
    )
    tool_call = resp.choices[0].message.tool_calls[0]
    return json.loads(tool_call.function.arguments)


async def _call_fallback(messages: list[dict], tool_schema: dict) -> dict:
    resp = await _fallback_client.chat.completions.create(
        model=settings.llm_fallback_model,
        messages=messages,
        tools=[tool_schema],
        tool_choice={"type": "function", "function": {"name": _TOOL_NAME}},
        temperature=0.1,
    )
    tool_call = resp.choices[0].message.tool_calls[0]
    return json.loads(tool_call.function.arguments)


async def ground_and_assemble(request: GroundAndAssembleRequest) -> GroundAndAssembleResponse:
    tool_schema = _build_tool_schema(request.candidates)
    messages = [
        {"role": "system", "content": _SYSTEM_PROMPT},
        {
            "role": "user",
            "content": (
                f"Mentions: {json.dumps(request.mentions, ensure_ascii=False)}\n\n"
                f"Candidates per mention: {_candidates_to_prompt_json(request.candidates)}"
            ),
        },
    ]

    try:
        raw_result = await _call_primary(messages, tool_schema)
    except Exception:
        try:
            raw_result = await _call_fallback(messages, tool_schema)
        except Exception as exc:
            raise LlmGroundingUnavailable(f"Both primary and fallback LLM calls failed: {exc}") from exc

    lines: list[OrderLineItem] = []
    ambiguous_items: list[AmbiguousItem] = []
    not_found_items: list[str] = []

    for line in raw_result.get("lines", []):
        raw_mention = line["raw_mention"]
        decision = line["decision"]
        mention_candidates = request.candidates.get(raw_mention, [])

        if decision == "select":
            picked_id = line.get("product_id")
            # Defense-in-depth: even though the schema enum already
            # constrained this to a real ID, confirm it belongs to THIS
            # mention's own candidate set (TDD §2.5 anti-hallucination note).
            matched = next((c for c in mention_candidates if str(c.product_id) == str(picked_id)), None)
            if matched is None:
                # Model picked a real ID that isn't valid for this mention
                # (e.g. cross-mention leakage) — fail safe to "not found"
                # rather than trust an unverifiable selection.
                not_found_items.append(raw_mention)
                continue

            quantity = line.get("quantity") or _default_quantity(request.mentions, raw_mention)
            lines.append(
                OrderLineItem(
                    product_id=matched.product_id,
                    matched_name=matched.matched_name,
                    quantity=quantity,
                    unit=matched.unit,
                    unit_price=matched.price,
                    raw_mention=raw_mention,
                )
            )

        elif decision == "clarify":
            if len(mention_candidates) < 1:
                not_found_items.append(raw_mention)
                continue
            ambiguous_items.append(
                AmbiguousItem(
                    raw_mention=raw_mention,
                    options=[f"{c.matched_name} ({c.unit})" for c in mention_candidates],
                    option_product_ids=[c.product_id for c in mention_candidates],
                )
            )

        else:  # not_found
            not_found_items.append(raw_mention)

    draft_order = DraftOrderJSON(
        session_id=request.session_id,
        store_id=request.store_id,
        customer_id=request.customer_id,
        intent=OrderIntent(request.intent) if request.intent in OrderIntent._value2member_map_ else OrderIntent.ADD_ITEM,
        lines=lines,
        language_mix=request.language_mix,
        channel=request.channel,
    )

    return GroundAndAssembleResponse(
        session_id=request.session_id,
        draft_order=draft_order,
        ambiguous_items=ambiguous_items,
        not_found_items=not_found_items,
    )


def _default_quantity(mentions: list[dict], raw_mention: str) -> float:
    for m in mentions:
        if m.get("raw_mention") == raw_mention and m.get("quantity_hint"):
            return float(m["quantity_hint"])
    return 1.0
