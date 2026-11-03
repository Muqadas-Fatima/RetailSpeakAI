"""Domain-specific exceptions and their HTTP mappings.

TDD §4.2 error behavior: "extraction-model timeout/failure -> return 503
with {'error': 'nlu_extraction_unavailable'}" is the pattern generalized
here for every stage of the NLU/grounding half — a stage-level failure is
distinguished from a *validation* rejection (which is a normal, expected
200-with-errors response, not an exception).
"""
from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse


class NluExtractionUnavailable(Exception):
    pass


class RagRetrievalUnavailable(Exception):
    pass


class LlmGroundingUnavailable(Exception):
    pass


class AsrUnavailable(Exception):
    pass


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(NluExtractionUnavailable)
    async def _nlu_unavailable(_: Request, __: NluExtractionUnavailable) -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={"error": "nlu_extraction_unavailable"},
        )

    @app.exception_handler(RagRetrievalUnavailable)
    async def _rag_unavailable(_: Request, __: RagRetrievalUnavailable) -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={"error": "rag_retrieval_unavailable"},
        )

    @app.exception_handler(LlmGroundingUnavailable)
    async def _llm_unavailable(_: Request, __: LlmGroundingUnavailable) -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={"error": "llm_grounding_unavailable"},
        )

    @app.exception_handler(AsrUnavailable)
    async def _asr_unavailable(_: Request, __: AsrUnavailable) -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={"error": "asr_unavailable"},
        )
