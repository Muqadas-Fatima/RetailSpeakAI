"""
Centralized configuration for the NLU/grounding half.

Every tunable referenced by the TDD as a "config value, not a hardcoded
constant" (similarity thresholds, circuit-breaker windows, retention) is
sourced from environment variables here — never inlined in service code.
See TDD §6.1 (thresholds), §2.2 (ASR failover), Foundation Plan §10
(RAG thresholds must be per-store-tunable; this is the process-wide default
that a per-store override in the DB can still take precedence over).
"""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    environment: str = "dev"
    log_level: str = "INFO"
    payment_env: str = "sandbox"

    # Database
    database_url: str = "postgresql+asyncpg://user:password@localhost:5432/retailspeak"

    # Redis (session state — TDD §2.1, keeps LLM workers stateless)
    redis_url: str = "redis://localhost:6379/0"
    session_ttl_seconds: int = 60 * 30  # 30 min idle session expiry

    # ASR — TDD §2.2
    groq_api_key: str = "mock-groq-key"
    groq_whisper_model: str = "whisper-large-v3"
    aws_access_key_id: str | None = None
    aws_secret_access_key: str | None = None
    aws_region: str = "me-south-1"
    asr_circuit_breaker_failure_threshold: int = 3
    asr_circuit_breaker_timeout_seconds: float = 2.5
    asr_circuit_breaker_open_seconds: float = 60.0

    # LLM grounding — TDD §2.5
    llm_primary_base_url: str = "http://localhost:8001/v1"
    llm_primary_model: str = "Qwen2.5-7B-Instruct"
    llm_primary_api_key: str = "not-needed-for-local-vllm"
    llm_fallback_provider: str = "groq"
    llm_fallback_model: str = "llama-3.1-8b-instant"
    llm_fallback_api_key: str = "mock-groq-key"

    # RAG — TDD §2.4, §6.1; Foundation Plan §10 (must be tunable, seeded here)
    embedding_model_name: str = "BAAI/bge-small-en-v1.5"
    embedding_dim: int = 384
    rag_similarity_floor: float = 0.72
    rag_auto_accept_threshold: float = 0.85
    rag_top_k: int = 3

    # Auth — TDD §14 (AWS Cognito, 4 roles)
    cognito_region: str = "me-south-1"
    cognito_user_pool_id: str = "mock-pool"
    cognito_app_client_id: str = "mock-client"
    cognito_jwks_url: str = "https://cognito-idp.me-south-1.amazonaws.com/mock-pool/.well-known/jwks.json"


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
