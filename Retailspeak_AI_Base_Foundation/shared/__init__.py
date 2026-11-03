"""shared/ — the one-copy package imported by both nlu-half/* and fulfillment-half/*.

Sub-packages:
  contracts/  Pydantic v2 models — the sole source of truth for every API boundary schema.
  auth/       Role vocabulary + role-check decorator for the four JWT roles (TDD §8.1).
  config/     Session-state shape (TDD §7.1) and per-store tunables (Plan §6).
  logging/    Structured JSON logging, correlated by order_id/session_id/pipeline_run_id.
"""
