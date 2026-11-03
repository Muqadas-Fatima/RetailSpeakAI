"""
Plan §6 — Open Decisions: "implement the stated safest placeholder as
configurable, not hardcoded, so resolving it later is a config or data
change." This module is where those per-store-tunable values live,
rather than as constants scattered through service code.

Two items land here explicitly per §6:
  - RAG confidence thresholds (0.72 / 0.85) -> tunable per-store config
  - Voice-recording retention -> 30-day default, configurable duration

Do NOT read these as globals-in-disguise: every field is meant to be
loaded per store_id from a config store (Postgres table or equivalent),
with these class defaults acting only as the fallback when a store has
no override row yet.
"""

from __future__ import annotations

from pydantic import BaseModel


class StoreConfig(BaseModel):
    store_id: str

    # TDD §6.3 / Plan §6: default disambiguation band. auto_accept_threshold
    # is the "obvious match, no question" cutoff; disambiguation_floor is the
    # cutoff below which a mention is unmatched/not_found, never reaching
    # the LLM candidate set.
    rag_auto_accept_threshold: float = 0.85
    rag_disambiguation_floor: float = 0.72

    # Plan §6: 30-day default, configurable duration.
    voice_recording_retention_days: int = 30

    # Plan §4 Phase 3 step 7: no-rider-available owner alert timer.
    rider_no_match_alert_minutes: int = 15

    # Plan §4 Phase 3 step 7: gps_reliable flips false after N missed
    # pings within a window.
    gps_missed_ping_threshold: int = 3
    gps_missed_ping_window_minutes: int = 5


def load_store_config(store_id: str) -> StoreConfig:
    """
    Placeholder loader. Real implementation reads an overrides row from
    Postgres (or a config service) keyed by store_id and merges over the
    StoreConfig defaults above; falls back to defaults when no row exists.
    Deliberately not wired to a real store yet — Phase 0 exit criteria is
    "every downstream phase can import a stable contract package," not a
    live config backend.
    """
    return StoreConfig(store_id=store_id)
