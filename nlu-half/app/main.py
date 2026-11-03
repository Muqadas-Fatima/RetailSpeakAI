"""
Entrypoint for the NLU/grounding half — TDD §1, §2.1-§2.6, §4.1-§4.4.

This process serves every stateless NLU/grounding endpoint from a single
FastAPI app for simplicity of deployment in this build; the Foundation
Plan's per-service topology (§2.2, §2.3) is preserved at the *module*
level (app/services/*.py map 1:1 to the TDD's component list) so this can
be split into independently deployed containers later without touching
business logic — only main.py's router mounting and each service's
Dockerfile would change.
"""
import logging

import structlog
from fastapi import FastAPI, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.core.exceptions import register_exception_handlers
from app.routers import nlu, rag, voice_ws

settings = get_settings()

logging.basicConfig(level=settings.log_level)
structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.add_log_level,
        structlog.processors.JSONRenderer(),
    ]
)
logger = structlog.get_logger()

app = FastAPI(
    title="RetailSpeak AI — NLU/Grounding Half",
    description=(
        "Stateless NLU/grounding layer: ASR -> non-LLM extraction -> RAG "
        "retrieval -> constrained LLM grounding -> Pydantic validation gate. "
        "Its only output artifact is a validated Order JSON (TDD §1)."
    ),
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if settings.environment == "dev" else [],  # tighten per-env in prod config
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

register_exception_handlers(app)

app.include_router(nlu.router)
app.include_router(rag.router)
app.include_router(voice_ws.router)


@app.get("/healthz", tags=["ops"])
async def healthz():
    return {"status": "ok", "environment": settings.environment}


@app.get("/readyz", tags=["ops"])
async def readyz():
    """Separate from /healthz so a load balancer can distinguish
    "process is up" from "dependencies (DB/Redis) are actually reachable" —
    matters for the autoscaling groups described in TDD §13.1."""
    from sqlalchemy import text

    from app.database import AsyncSessionLocal
    from app.redis_client import get_redis

    checks = {}
    try:
        async with AsyncSessionLocal() as session:
            await session.execute(text("SELECT 1"))
        checks["database"] = "ok"
    except Exception as exc:
        checks["database"] = f"error: {exc}"

    try:
        await get_redis().ping()
        checks["redis"] = "ok"
    except Exception as exc:
        checks["redis"] = f"error: {exc}"

    all_ok = all(v == "ok" for v in checks.values())
    return JSONResponse(
        status_code=status.HTTP_200_OK if all_ok else status.HTTP_503_SERVICE_UNAVAILABLE,
        content={"status": "ok" if all_ok else "degraded", "checks": checks},
    )
