# RetailSpeak AI — NLU/Grounding Half

Backend implementation of the **stateless NLU/grounding layer** specified in
`RetailSpeak_AI_TDD.md` §1–§2, §4.1–§4.4, and Foundation Plan §2.2's
`nlu-half/` topology: ASR → non-LLM extraction → RAG retrieval → constrained
LLM grounding → Pydantic validation gate. Its only output artifact is a
validated `OrderJSON`; it never touches inventory, payment, khata, or any
fulfillment concern (that's the fulfillment half, out of scope here).

## Stack

- **FastAPI** + **SQLAlchemy 2.0 (async)** + **PostgreSQL/pgvector** (Supabase-compatible)
- **Redis** (Upstash-compatible) for stateless-worker session state
- **Groq** (Whisper ASR + LLaMA-3.1 LLM fallback), **AWS Transcribe** (ASR fallback)
- **BGE-Small-EN-v1.5** via `sentence-transformers` for catalog embeddings
- **AWS Cognito** JWT verification (4-role model)

## Running locally

```bash
cp .env.example .env   # fill in real credentials
docker compose up --build
```

The compose file seeds Postgres from `sql/schema.sql` (includes pgvector
extension setup + a small bilingual fixture catalog). After first boot, run:

```bash
docker compose exec app python -m scripts.backfill_embeddings
```

to populate `products.embedding` for the seed catalog (or for any new rows
you insert) — RAG retrieval returns nothing useful until this has run.

API docs: `http://localhost:8000/docs` (FastAPI auto-generated OpenAPI UI).

## Endpoints (TDD §4.1–§4.4)

| Method | Path | Purpose |
|---|---|---|
| `WS` | `/v1/voice/sessions/{session_id}/stream?token=...&store_id=...` | Binary Opus in, `transcript.partial`/`transcript.final` JSON out |
| `POST` | `/v1/nlu/extract-mentions` | Transcript/chat text → intent + raw item mentions (non-LLM) |
| `POST` | `/v1/rag/candidates` | Mentions → scored real catalog candidates per store |
| `POST` | `/v1/nlu/ground-and-assemble` | Mentions + candidates → draft Order JSON, or clarification/not-found |
| `GET` | `/healthz` | Liveness |
| `GET` | `/readyz` | Readiness (checks DB + Redis connectivity) |

All `POST`/`WS` endpoints require a Cognito-issued Bearer JWT (query param
`token` for the WebSocket, since browsers can't set headers on the WS
handshake). Roles accepted: `customer`, `service` (the latter for a
dialogue-manager/BFF calling on a customer's behalf).

### Typical turn sequence a frontend should drive

1. Open the WS stream, send Opus frames, send `{"type":"end_of_turn"}` →
   receive `transcript.final`.
2. `POST /v1/nlu/extract-mentions` with that transcript.
3. `POST /v1/rag/candidates` with the mentions from step 2.
4. `POST /v1/nlu/ground-and-assemble` with mentions + candidates from steps 2–3.
5. If `ambiguous_items` or `not_found_items` is non-empty, render that back to
   the customer and repeat from step 1 for their reply — **do not treat the
   order as confirmable** (TDD §4.4).
6. Once every line is resolved, render `draft_order` back for confirmation
   (TDD §4.5). Confirmation itself, and submission to the fulfillment half
   (`POST /v1/fulfillment/orders` with an HMAC-signed `ConfirmedOrder`), is
   **not** part of this build — that's the dialogue-manager/confirmation-turn
   layer sitting just outside this service, per Foundation Plan §1.

## What's a placeholder, on purpose

Per the TDD's own §15 Open Technical Questions and this environment's
constraints, the following are implemented as clearly-marked integration
seams rather than guessed at:

- **AWS Transcribe fallback** (`app/services/asr_service.py`) — the
  S3-upload + `start_transcription_job` + polling loop is stubbed with a
  `NotImplementedError` and a comment describing exactly what to wire in;
  the *interface* (bytes in, `TranscriptResult` out) and the circuit-breaker
  failover logic around it are fully implemented and tested.
- **Primary LLM** — TDD specifies self-hosted Qwen-2.5-7B via vLLM (TDD §2.5,
  §14). This environment can't host a GPU vLLM server, so
  `LLM_PRIMARY_BASE_URL` points at any OpenAI-compatible endpoint you run;
  point it at your real vLLM deployment in staging/prod. The Groq fallback
  path is fully live and is what local dev will exercise by default.
- **Fine-tuned NER extractor** — TDD §2.3 specifies a fine-tuned
  XLM-RoBERTa-base token classifier. That model artifact can't be trained
  here; `nlu_extraction_service.py` implements the same input/output
  contract with a deterministic rule/regex tagger, with the model-swap point
  isolated to a single function so dropping in the real fine-tuned model
  later doesn't touch any caller.
- **Per-store RAG thresholds** (`stores.rag_similarity_floor` /
  `rag_auto_accept_threshold`) — implemented as nullable per-store overrides
  falling back to the process-wide `.env` defaults, per Foundation Plan §10's
  explicit instruction that these must be tunable config, not hardcoded.

## Tests

```bash
export TEST_DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/retailspeak_test
pytest
```

- `test_validation_gate.py` — the adversarial hallucination suite Foundation
  Plan §9 requires alongside the validation gate: asserts 100% rejection of
  any `product_id` not in the live catalog, cross-store product references,
  and over-max-quantity lines.
- `test_rag_threshold.py` — asserts the 0.72 similarity floor is enforced
  (and is per-store overridable) per TDD §2.4/§6.1.
- `test_nlu_extraction.py` — pure-function tests for Roman-Urdu/Urdu numeral
  normalization and multi-item mention splitting.

Note: pgvector requires real Postgres (not SQLite) — CI should run these
against a `pgvector`-enabled Postgres service container.
