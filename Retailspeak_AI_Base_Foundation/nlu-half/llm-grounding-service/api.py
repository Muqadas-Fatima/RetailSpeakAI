"""
TDD §4.4 — POST /v1/nlu/ground-and-assemble.

Hard constraint (TDD §2.5, §14): the LLM's container has network egress
only to the RAG retrieval service and holds no DB connection, service
credential, or payment credential. This file's imports reflect that —
it never imports fulfillment-half or a payment/DB client, only the
pipeline contracts and the grounder module.
"""

from __future__ import annotations

import os
import sys

_HERE = os.path.dirname(os.path.abspath(__file__))
_NLU_HALF = os.path.dirname(_HERE)
sys.path.insert(0, os.path.dirname(_NLU_HALF))  # repo root -> `shared.*`
sys.path.insert(0, _NLU_HALF)  # nlu-half/    -> `contracts.*`

from fastapi import FastAPI

from contracts.pipeline_io import GroundAndAssembleRequest, GroundAndAssembleResponse
from grounder import LLMGrounder, MockRuleBasedGrounder

app = FastAPI(title="llm-grounding-service")

# Swap this one line for the real vLLM/Qwen-2.5-7B-backed grounder when
# it's ready (with Groq LLaMA-3.1-8B as the TDD §2.5 fallback).
_grounder: LLMGrounder = MockRuleBasedGrounder()


@app.post("/v1/nlu/ground-and-assemble", response_model=GroundAndAssembleResponse)
def ground_and_assemble(request: GroundAndAssembleRequest) -> GroundAndAssembleResponse:
    # Note: the draft order returned here is UNVALIDATED (TDD §2.6) — it
    # still has to pass the Pydantic Validation Gate (Phase 2) before it's
    # written back to session state. Callers must not treat this response
    # as confirmable on its own.
    return _grounder.ground_and_assemble(request)
