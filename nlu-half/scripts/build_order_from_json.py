"""Apply the latest catalog-matching output to the running order of its session.

Usage (from nlu-half):
    python -m scripts.build_order_from_json            # apply output/llm_inputs/latest.json as the next turn
    python -m scripts.build_order_from_json --reset    # forget this session's saved order/questions first
    python -m scripts.build_order_from_json <path>     # use another llm_inputs json file
Writes output/orders/latest_order.json
"""
import asyncio
import json
import sys
import uuid
from pathlib import Path

from app.database import AsyncSessionLocal
from app.redis_client import SessionStore
from app.services import order_dialog_service

DEFAULT_INPUT = Path(__file__).resolve().parents[1] / "output" / "llm_inputs" / "latest.json"
LANG_CODES = {"english": "en", "urdu": "ur"}


async def main(path: Path, reset: bool) -> None:
    data = json.loads(path.read_text(encoding="utf-8"))
    langs = sorted(
        {
            LANG_CODES.get(str(seg.get("lang", "")).lower(), str(seg.get("lang", "")).lower())
            for seg in data.get("language_segments", [])
        }
    )
    store = SessionStore()
    try:
        if reset:
            await store.delete(data["session_id"])
            print("Session state cleared.")
        async with AsyncSessionLocal() as db:
            result = await order_dialog_service.process_turn(
                db,
                store,
                session_id=data["session_id"],
                store_id=uuid.UUID(data["store_id"]),
                transcript=data.get("transcript", ""),
                items=data.get("items", []),
                language_mix=langs,
                turn_id=data.get("created_at"),
            )
    finally:
        try:
            await store.redis.aclose()
        except Exception:
            pass

    print("\n==================== ORDER RESULT ====================")
    print("transcript :", result["transcript"])
    print("status     :", result["status"], "| blocks_confirmation:", result["blocks_confirmation"])
    if result.get("reason"):
        print("reason     :", result["reason"])
    if result["order"]:
        for line in result["order"]["lines"]:
            print(
                f"  LINE : {line['matched_name']}  x {line['quantity']} {line['unit']}"
                f"  @ {line['unit_price']} = {line['line_total']}"
                + (f"  [note: {line['note']}]" if line.get("note") else "")
            )
        print("  subtotal:", result["subtotal"])
    for c in result["clarifications"]:
        print(f"  ASK  : {c['question']}  (qty requested: {c['requested_quantity']})")
        for i, o in enumerate(c["options"], 1):
            print(f"         {i}. {o['name']} @ {o['price']}")
    for name in result["not_found"]:
        print("  NOT FOUND:", name)
    for name in result.get("removed_unavailable", []):
        print("  REMOVED (no longer in catalog):", name)
    for e in result["validation_errors"]:
        print("  VALIDATION ERROR:", e)
    print("file       :", result.get("file"))


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    asyncio.run(main(Path(args[0]) if args else DEFAULT_INPUT, "--reset" in sys.argv))