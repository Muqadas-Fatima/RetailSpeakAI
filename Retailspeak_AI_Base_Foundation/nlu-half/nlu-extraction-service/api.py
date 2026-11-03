"""
TDD §4.2 — POST /v1/nlu/extract-mentions.

Path setup note (Phase 1 scaffold): each service directory is hyphenated
(matches Plan §3's repo tree) so it can't be a dotted Python package
itself — that's fine, each service ships its own container (Plan §3) and
its own PYTHONPATH. In a real container this is set via Dockerfile
ENV/WORKDIR; here we set it explicitly so the scaffold is runnable
as-is without extra setup.
"""

from __future__ import annotations

import os
import sys

_HERE = os.path.dirname(os.path.abspath(__file__))
_NLU_HALF = os.path.dirname(_HERE)
sys.path.insert(0, os.path.dirname(_NLU_HALF))  # repo root -> `shared.*` (contracts.pipeline_io needs it)
sys.path.insert(0, _NLU_HALF)  # nlu-half/    -> `contracts.*`

from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse

from contracts.pipeline_io import ExtractMentionsRequest, ExtractMentionsResponse
from extractor import MockRuleBasedExtractor, NLUExtractor

app = FastAPI(title="nlu-extraction-service")

# Swap this one line for the real NER-backed extractor when it's ready;
# nothing else in this file changes.
_extractor: NLUExtractor = MockRuleBasedExtractor()


@app.post("/v1/nlu/extract-mentions", response_model=ExtractMentionsResponse)
def extract_mentions(request: ExtractMentionsRequest) -> ExtractMentionsResponse:
    try:
        return _extractor.extract_mentions(request)
    except Exception:
        # TDD §4.2 error behavior: extraction-model timeout/failure -> 503
        # with {"error": "nlu_extraction_unavailable"}, so the dialogue
        # manager plays a "please repeat" prompt rather than dropping the
        # turn silently. Never surface a raw 500/stack trace here.
        return JSONResponse(
            status_code=503,
            content={"error": "nlu_extraction_unavailable"},
        )
