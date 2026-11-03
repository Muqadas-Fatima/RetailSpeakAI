"""TDD §4.3 — POST /v1/rag/candidates."""

from __future__ import annotations

import os
import sys

_HERE = os.path.dirname(os.path.abspath(__file__))
_REPO_ROOT = os.path.dirname(_HERE)
sys.path.insert(0, os.path.dirname(_REPO_ROOT))  # repo root -> `shared.*`
sys.path.insert(0, _REPO_ROOT)  # nlu-half/    -> `contracts.*`

from fastapi import FastAPI

from contracts.pipeline_io import RAGCandidatesRequest, RAGCandidatesResponse
from retriever import MockSimilarityRetriever, RAGRetriever
from shared.config.store_config import load_store_config

app = FastAPI(title="rag-retrieval-service")

# Swap this one line for the real pgvector-backed retriever when it's ready.
_retriever: RAGRetriever = MockSimilarityRetriever()


@app.post("/v1/rag/candidates", response_model=RAGCandidatesResponse)
def get_candidates(request: RAGCandidatesRequest) -> RAGCandidatesResponse:
    store_config = load_store_config(request.store_id)
    return _retriever.get_candidates(request, store_config)
