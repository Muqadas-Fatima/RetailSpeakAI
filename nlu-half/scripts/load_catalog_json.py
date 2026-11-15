"""
Load data/sample_catalog.json (English + Urdu script + Roman-Urdu names and
aliases for 476 products) into the products table.

- Only fills columns that exist in YOUR products table.
- Idempotent: fixed UUIDs + upsert. Re-running never resets stock.
- Old rows of this store that are not in the JSON are DEACTIVATED (not deleted).

Usage (from the nlu-half folder):  python -m scripts.load_catalog_json
"""
import asyncio
import json
import uuid
from pathlib import Path

from sqlalchemy import text

from app.database import AsyncSessionLocal

STORE_ID = "11111111-1111-1111-1111-111111111111"
NS = uuid.UUID("12345678-1234-5678-1234-567812345678")
CATALOG = Path(__file__).resolve().parents[1] / "data" / "sample_catalog.json"

UUID_COLS = {"product_id", "store_id"}
KEEP_ON_UPDATE = {"product_id", "store_id", "in_stock_qty", "low_stock_threshold", "max_order_qty", "is_active"}


def product_uuid(code: str) -> str:
    return str(uuid.uuid5(NS, f"catalog-json|{code}"))


async def main() -> None:
    items = json.loads(CATALOG.read_text(encoding="utf-8"))
    ids = [product_uuid(p["product_id"]) for p in items]

    async with AsyncSessionLocal() as s:
        result = await s.execute(
            text("SELECT column_name FROM information_schema.columns WHERE table_name = 'products'")
        )
        existing = {row[0] for row in result}
        print("products columns:", ", ".join(sorted(existing)))

        def build_values(p: dict) -> dict:
            return {
                "product_id": product_uuid(p["product_id"]),
                "store_id": STORE_ID,
                "name_en": p["name_en"],
                "name_ur": p.get("name_ur"),
                "name_roman_ur": p.get("name_roman_ur"),
                "aliases": p.get("aliases"),
                "category": p.get("category") or "general",
                "unit": p.get("unit") or "pcs",
                "price": p.get("price") or 0,
                "in_stock_qty": 100,
                "low_stock_threshold": 10,
                "max_order_qty": 50,
                "is_active": True,
            }

        cols = [c for c in build_values(items[0]) if c in existing]
        placeholders = [
            f"CAST(:{c} AS uuid)" if c in UUID_COLS else f":{c}" for c in cols
        ]
        updates = [f"{c} = EXCLUDED.{c}" for c in cols if c not in KEEP_ON_UPDATE]
        sql = (
            f"INSERT INTO products ({', '.join(cols)}) "
            f"VALUES ({', '.join(placeholders)}) "
            f"ON CONFLICT (product_id) DO UPDATE SET {', '.join(updates)}, "
            f"is_active = true, updated_at = now()"
        )

        for p in items:
            values = build_values(p)
            await s.execute(text(sql), {c: values[c] for c in cols})

        await s.execute(
            text(
                "UPDATE products SET is_active = false, updated_at = now() "
                "WHERE store_id = CAST(:sid AS uuid) "
                "AND product_id <> ALL(CAST(:ids AS uuid[]))"
            ),
            {"sid": STORE_ID, "ids": ids},
        )
        await s.commit()
    print(f"Loaded {len(items)} products. Old rows deactivated.")


if __name__ == "__main__":
    asyncio.run(main())