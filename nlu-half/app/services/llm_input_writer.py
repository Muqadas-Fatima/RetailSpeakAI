"""Writes the extracted-products JSON that the LLM stage consumes."""
import json
from datetime import datetime, timezone
from pathlib import Path

# nlu-half/output/llm_inputs/
OUTPUT_DIR = Path(__file__).resolve().parents[2] / "output" / "llm_inputs"


def write_llm_input(
    *,
    session_id: str,
    store_id: str,
    transcript: str,
    language_segments: list,
    match: dict,
) -> Path:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    now = datetime.now(timezone.utc)
    items = match.get("matches", [])

    payload = {
        "session_id": session_id,
        "store_id": store_id,
        "created_at": now.isoformat(),
        "transcript": transcript,
        "language_segments": language_segments,
        "extracted_products": match.get("product_names", []),
        "items": items,
        "needs_clarification": any(item.get("ambiguous") for item in items),
        "no_match": len(items) == 0,
    }

    # session_id comes from the client, so keep only safe filename characters
    safe_session = "".join(c for c in session_id if c.isalnum() or c in "-_")[:64]
    filename = f"{now.strftime('%Y%m%dT%H%M%S%fZ')}_{safe_session}.json"

    text = json.dumps(payload, ensure_ascii=False, indent=2)
    path = OUTPUT_DIR / filename
    path.write_text(text, encoding="utf-8")
    (OUTPUT_DIR / "latest.json").write_text(text, encoding="utf-8")  # always the newest turn
    return path