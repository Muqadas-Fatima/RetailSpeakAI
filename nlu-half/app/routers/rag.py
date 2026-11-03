from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import RagRetrievalUnavailable
from app.core.security import AuthenticatedUser, require_roles
from app.database import get_db
from app.schemas.rag import RagCandidatesRequest, RagCandidatesResponse
from app.services import rag_service

router = APIRouter(prefix="/v1/rag", tags=["rag"])


@router.post("/candidates", response_model=RagCandidatesResponse)
async def get_candidates(
    payload: RagCandidatesRequest,
    db: AsyncSession = Depends(get_db),
    user: AuthenticatedUser = Depends(require_roles("customer", "service")),
):
    """
    TDD §4.3: this response — including each candidate's raw similarity
    score — is passed directly into the LLM call as its input. It is never
    shown to the customer as-is.
    """
    try:
        return await rag_service.retrieve_candidates(db, payload.store_id, payload.mentions)
    except Exception as exc:
        raise RagRetrievalUnavailable(str(exc)) from exc
