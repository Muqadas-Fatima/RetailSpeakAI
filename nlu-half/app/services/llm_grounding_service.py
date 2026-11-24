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
import re
import unicodedata
import uuid
from dataclasses import dataclass
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
    "voice/chat ordering assistant. You receive (1) the customer's full sentence "
    "(Urdu script, English, or Roman Urdu) and (2) the item mentions found in it by "
    "catalog search. Each mention comes with a short list of REAL catalog products "
    "(candidates), each with a similarity_score.\n\n"
    "For EACH mention decide exactly one of:\n"
    "  - 'select': pick the product_id from THAT mention's own candidate list. Use it when one "
    "candidate is clearly what the customer meant (a single candidate with similarity_score >= 0.85, "
    "or the sentence itself names the brand/size that singles one candidate out).\n"
    "  - 'clarify': when 2+ candidates are plausible (different brands or sizes) and the sentence does "
    "not decide between them, or the single candidate's score is between 0.72 and 0.85. Write ONE short, "
    "natural question naming the options, in the SAME language/script the customer used.\n"
    "  - 'not_found': when the mention has NO candidates.\n\n"
    "QUANTITY (for 'select' and also for 'clarify', so it is not lost): quantity is the number of units "
    "(packs) of the product the customer wants, read from the sentence next to that mention. "
    "Number words: aik/ek/ایک/one=1, do/دو/two=2, teen/تین/three=3, char/چار/four=4, panch/پانچ/five=5, "
    "dozen/darjan/درجن=12, aadha/آدھا=0.5. A weight or volume ('2 kilo', '500 gram', '1 litre') "
    "describes pack size: if the chosen candidate's name contains that size, quantity is the number of "
    "packs ('2 kilo' of a 1kg product = 2; '5 kg' of a 5kg product = 1). If NO candidate has that size "
    "(for example '2 kilo rice' but packs are 1kg/5kg/10kg) use 'clarify' and suggest the closest "
    "pack(s). If the customer gives no number, quantity = 1.\n"
    "ACTION per mention (default 'add'):\n"
    "  - 'remove': the customer does NOT want the item or wants it taken out entirely ('don't want', "
    "'do not want', 'remove', 'cancel', 'delete', 'without', 'nahi chahiye', 'hata do', 'نہیں چاہیے', "
    "'ہٹا دو'). quantity = null.\n"
    "  - 'reduce': the customer takes out SOME units ('remove 1', 'ek kam kar do'). quantity = units to take out.\n"
    "  - 'set_quantity': the customer changes the amount of an item already ordered ('make it 3', "
    "'change to 2', '3 kar do', 'sirf 2'). quantity = the new total.\n"
    "  - 'add': everything else.\n"
    "A negated mention must NEVER be 'add'.\n"
    "NOTE: if the customer adds an instruction for an item (e.g. 'thanda', 'fresh', 'extra'), put it "
    "in 'note'; otherwise leave it null.\n\n"
    "HARD RULES: copy raw_mention exactly as given. You may ONLY select a product_id that appears in "
    "that mention's own candidate list. NEVER invent a product, id, name, price, or unit. "
    "Return one entry per mention."
)


def _build_tool_schema(candidates: dict[str, list[RagCandidate]]) -> dict[str, Any]:
    all_ids = sorted({str(c.product_id) for cands in candidates.values() for c in cands})
    # An empty enum is invalid JSON schema, so guarantee at least a
    # placeholder the model can never legitimately choose but that keeps
    # the schema well-formed when every mention is unmatched.
    id_enum = all_ids or ["__no_candidates__"]
    # raw_mention is also an enum, so the model cannot rename a mention and
    # silently lose its candidate list.
    mention_enum = list(candidates.keys()) or ["__no_mentions__"]

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
                                "raw_mention": {"type": "string", "enum": mention_enum},
                                "decision": {"type": "string", "enum": ["select", "clarify", "not_found"]},
                                "product_id": {
                                    "type": ["string", "null"],
                                    "enum": id_enum + [None],
                                },
                                "quantity": {"type": ["number", "null"]},
                                "clarification_question": {"type": ["string", "null"]},
                                "note": {"type": ["string", "null"]},
                                "action": {"type": "string", "enum": ["add", "remove", "reduce", "set_quantity"]},
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
        tool_choice={"type": "function", "function": {"name": tool_schema["function"]["name"]}},
        temperature=0.1,
    )
    tool_call = resp.choices[0].message.tool_calls[0]
    return json.loads(tool_call.function.arguments)


async def _call_fallback(messages: list[dict], tool_schema: dict) -> dict:
    resp = await _fallback_client.chat.completions.create(
        model=settings.llm_fallback_model,
        messages=messages,
        tools=[tool_schema],
        tool_choice={"type": "function", "function": {"name": tool_schema["function"]["name"]}},
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
                (f"Customer said: {json.dumps(request.transcript, ensure_ascii=False)}\n\n" if request.transcript else "")
                + f"Mentions: {json.dumps(request.mentions, ensure_ascii=False)}\n\n"
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

            quantity = _safe_quantity(line.get("quantity"), request.mentions, raw_mention)
            lines.append(
                OrderLineItem(
                    product_id=matched.product_id,
                    matched_name=matched.matched_name,
                    quantity=quantity,
                    unit=matched.unit,
                    unit_price=matched.price,
                    raw_mention=raw_mention,
                    note=(line.get("note") or None),
                    action=_safe_action(line.get("action")),
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
                    question=(line.get("clarification_question") or _default_question(raw_mention, mention_candidates)),
                    requested_quantity=_safe_quantity(line.get("quantity"), request.mentions, raw_mention),
                    action=_safe_action(line.get("action")),
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


def _safe_action(value: Any) -> str:
    return value if value in ("add", "remove", "reduce", "set_quantity") else "add"


def _norm_text(value: str) -> str:
    return " ".join(re.sub(r"[^\w\s]", " ", unicodedata.normalize("NFKC", value or "").lower().replace("'", "")).split())


def _evidence_ok(evidence: Any, transcript: str) -> bool:
    """The model must quote words that really occur in the customer's sentence."""
    if not isinstance(evidence, str):
        return False
    ev = _norm_text(evidence)
    return bool(ev) and len(ev) <= 80 and f" {ev} " in f" {_norm_text(transcript)} "


def _safe_quantity(value: Any, mentions: list[dict], raw_mention: str) -> float:
    """LLM quantity if it is a positive number, else the mention's hint, else 1."""
    try:
        q = float(value)
        if q > 0:
            return q
    except (TypeError, ValueError):
        pass
    return _default_quantity(mentions, raw_mention)


def _default_question(raw_mention: str, candidates: list[RagCandidate]) -> str:
    names = ", ".join(c.matched_name for c in candidates[:5])
    return f"Which one do you mean for '{raw_mention}'? {names}"


# --------------------------------------------------------------------------- #
# Clarification follow-up: resolve the customer's answer against the options
# that were offered earlier (and ONLY those options).
# --------------------------------------------------------------------------- #
_RESOLVE_TOOL_NAME = "resolve_pending_items"

_RESOLVE_PROMPT = (
    "You resolve clarification questions in a Pakistani grocery voice/chat ordering assistant. "
    "Earlier the assistant asked the customer to choose between real catalog products. You receive the "
    "customer's NEW sentence (Urdu script, English, or Roman Urdu) and, for each pending question, its "
    "numbered options.\n\n"
    "For EACH pending item decide exactly one:\n"
    "  - 'resolve': the sentence clearly singles out ONE option (by brand, size, price, or position such "
    "as 'the first one'/'pehla'/'doosra', 'the cheaper one', 'the 5 kg one'). product_id MUST be one of "
    "THAT pending item's own options.\n"
    "  - 'still_unclear': the sentence is about this item but leaves 2+ options possible (for example only "
    "a brand that fits several sizes). Write ONE short new question naming only the remaining options, in "
    "the customer's language.\n"
    "  - 'cancel': the customer drops this item ('nahi chahiye', 'chhor do', 'cancel', 'forget it').\n"
    "  - 'unrelated': the sentence does not address this item.\n\n"
    "evidence: REQUIRED for 'resolve' and 'cancel': copy, word for word, the part of the customer's sentence "
    "that justifies your decision (for example '5 kg', 'pehla', 'don't want it'). If the sentence contains no "
    "such words, the decision is 'unrelated'. A sentence that does not mention the item, its brand, size, "
    "price or position is 'unrelated' (for example 'this is my final order' or 'thanks').\n"
    "quantity: only if the sentence states a NEW quantity for this item ('make it 3', 'teen kar do'); "
    "otherwise null (the earlier quantity is kept). A size like '5 kg' selects an option, it is not a quantity.\n"
    "HARD RULES: copy pending_id exactly. NEVER invent a product, id, name or price. Return one entry per "
    "pending item."
)


@dataclass
class PendingResolution:
    pending_id: str
    decision: str  # resolve | still_unclear | cancel | unrelated
    product_id: uuid.UUID | None = None
    quantity: float | None = None
    question: str | None = None


async def _call_llm(messages: list[dict], tool_schema: dict) -> dict:
    try:
        return await _call_primary(messages, tool_schema)
    except Exception:
        try:
            return await _call_fallback(messages, tool_schema)
        except Exception as exc:
            raise LlmGroundingUnavailable(f"Both primary and fallback LLM calls failed: {exc}") from exc


def _build_resolve_schema(pending: list[dict]) -> dict[str, Any]:
    pending_ids = [p["pending_id"] for p in pending]
    option_ids = sorted({str(o["product_id"]) for p in pending for o in p["options"]})
    return {
        "type": "function",
        "function": {
            "name": _RESOLVE_TOOL_NAME,
            "description": "Emit the resolution of every pending clarification.",
            "parameters": {
                "type": "object",
                "properties": {
                    "resolutions": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "pending_id": {"type": "string", "enum": pending_ids},
                                "decision": {
                                    "type": "string",
                                    "enum": ["resolve", "still_unclear", "cancel", "unrelated"],
                                },
                                "product_id": {"type": ["string", "null"], "enum": option_ids + [None]},
                                "quantity": {"type": ["number", "null"]},
                                "clarification_question": {"type": ["string", "null"]},
                                "evidence": {"type": ["string", "null"]},
                            },
                            "required": ["pending_id", "decision"],
                        },
                    }
                },
                "required": ["resolutions"],
            },
        },
    }


async def resolve_pending(transcript: str, pending: list[dict]) -> list[PendingResolution]:
    """`pending` items: {pending_id, raw_mention, question, requested_quantity,
    options: [{product_id, name, unit, price}]}. Returns one resolution per pending item."""
    if not pending:
        return []
    schema = _build_resolve_schema(pending)
    shown = [
        {
            "pending_id": p["pending_id"],
            "mention": p["raw_mention"],
            "question_asked": p.get("question"),
            "requested_quantity": p.get("requested_quantity"),
            "options": [
                {"option_no": i + 1, "product_id": str(o["product_id"]), "name": o["name"], "price": o["price"]}
                for i, o in enumerate(p["options"])
            ],
        }
        for p in pending
    ]
    messages = [
        {"role": "system", "content": _RESOLVE_PROMPT},
        {
            "role": "user",
            "content": (
                f"Customer said now: {json.dumps(transcript, ensure_ascii=False)}\n\n"
                f"Pending questions: {json.dumps(shown, ensure_ascii=False)}"
            ),
        },
    ]
    raw = await _call_llm(messages, schema)

    # ---- defense in depth: never trust the model's ids ----
    by_id = {p["pending_id"]: p for p in pending}
    seen: dict[str, PendingResolution] = {}
    for entry in raw.get("resolutions", []):
        pid = entry.get("pending_id")
        item = by_id.get(pid)
        if item is None or pid in seen:
            continue
        decision = entry.get("decision")
        if decision not in ("resolve", "still_unclear", "cancel", "unrelated"):
            decision = "unrelated"
        question = entry.get("clarification_question") or None
        if decision in ("resolve", "cancel") and not _evidence_ok(entry.get("evidence"), transcript):
            decision = "unrelated"  # no quoted words from the sentence -> not an answer
        chosen: uuid.UUID | None = None
        if decision == "resolve":
            allowed = {str(o["product_id"]) for o in item["options"]}  # THIS item's options only
            if str(entry.get("product_id")) in allowed:
                chosen = uuid.UUID(str(entry["product_id"]))
            else:
                decision = "still_unclear"  # foreign / invented id -> ask again, never accept
        quantity = None
        try:
            q = float(entry.get("quantity"))
            quantity = q if q > 0 else None
        except (TypeError, ValueError):
            quantity = None
        seen[pid] = PendingResolution(pid, decision, chosen, quantity, question)

    # a pending item the model skipped stays pending
    return [seen.get(p["pending_id"], PendingResolution(p["pending_id"], "unrelated")) for p in pending]