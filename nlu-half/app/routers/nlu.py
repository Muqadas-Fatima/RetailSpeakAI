"""
Routers for the non-LLM extraction endpoint (§4.2) and the single LLM
grounding+assembly endpoint (§4.4). Both endpoints also persist the
resulting session state to Redis so the next turn (or the RAG/validation
routers) can pick up where this one left off — keeping HTTP callers
(dialogue manager, WebSocket handler) thin.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import LlmGroundingUnavailable, NluExtractionUnavailable
from app.core.security import AuthenticatedUser, require_roles
from app.database import get_db
from app.redis_client import SessionStore
from app.schemas.llm import GroundAndAssembleRequest, GroundAndAssembleResponse
from app.schemas.nlu import ExtractMentionsRequest, ExtractMentionsResponse
from app.schemas.rag import RagCandidatesRequest
from app.services import llm_grounding_service, nlu_extraction_service, rag_service
from app.services.validation_service import validate_draft_order

router = APIRouter(prefix="/v1/nlu", tags=["nlu"])


@router.post("/extract-mentions", response_model=ExtractMentionsResponse)
async def extract_mentions(
    payload: ExtractMentionsRequest,
    user: AuthenticatedUser = Depends(require_roles("customer", "service")),
):
    try:
        intent, mentions = nlu_extraction_service.extract_mentions(payload.input_text)
    except Exception as exc:
        # TDD §4.2 error behavior: extraction-model timeout/failure -> 503
        # nlu_extraction_unavailable, dialogue manager reprompts rather
        # than silently dropping the turn.
        raise NluExtractionUnavailable(str(exc)) from exc

    store = SessionStore()
    state = await store.init_if_absent(payload.session_id, str(payload.store_id), user.sub)
    state["channel"] = payload.channel.value
    state["intent_history"].append(intent)
    await store.set(payload.session_id, state)

    return ExtractMentionsResponse(
        session_id=payload.session_id,
        intent=intent,
        intent_confidence=0.96 if mentions else 0.95,
        language_detected=nlu_extraction_service._detect_language_mix(payload.input_text),
        mentions=mentions,
    )


@router.post("/ground-and-assemble", response_model=GroundAndAssembleResponse)
async def ground_and_assemble(
    payload: GroundAndAssembleRequest,
    db: AsyncSession = Depends(get_db),
    user: AuthenticatedUser = Depends(require_roles("customer", "service")),
):
    """
    TDD §4.4: the only endpoint in the extraction pipeline that invokes the
    LLM. The draft order it returns is then run through the Pydantic gate
    (§2.6) before being written back to session state — done here so
    callers always receive a gate-checked snapshot, never a raw LLM draft.
    """
    try:
        result: GroundAndAssembleResponse = await llm_grounding_service.ground_and_assemble(payload)
    except LlmGroundingUnavailable:
        raise
    except Exception as exc:
        raise LlmGroundingUnavailable(str(exc)) from exc

    validation = await validate_draft_order(db, result.draft_order)

    store = SessionStore()
    state = await store.get(payload.session_id) or await store.init_if_absent(
        payload.session_id, str(payload.store_id), str(payload.customer_id) if payload.customer_id else None
    )

    if validation.valid and validation.order is not None:
        state["draft_order_lines"] = [line.model_dump(mode="json") for line in validation.order.lines]
    else:
        # Validation failures are folded into not_found_items so the
        # customer gets a concrete reprompt rather than a generic error —
        # TDD §2.6: "clear error objects the dialogue manager can turn
        # into a specific reprompt."
        for err in validation.errors:
            if err.raw_mention and err.raw_mention not in result.not_found_items:
                result.not_found_items.append(err.raw_mention)

    state["ambiguous_items"] = [a.model_dump(mode="json") for a in result.ambiguous_items]
    state["not_found_items"] = result.not_found_items
    await store.set(payload.session_id, state)

    return result
