"""
Backfill embeddings for any product whose `embedding` column is NULL —
run after seeding/importing a catalog, and again after any bulk catalog
update (Foundation Plan §10 treats this as "N individual inserts for now"
pending the dedicated bulk-import tool that TDD §15 flags as unbuilt).

Usage:
    python -m scripts.backfill_embeddings
"""
import asyncio

from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.models.db_models import Product
from app.services.rag_service import reindex_product


async def main() -> None:
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Product).where(Product.embedding.is_(None)))
        products = result.scalars().all()
        print(f"Found {len(products)} product(s) missing embeddings.")

        for product in products:
            await reindex_product(db, product)
            print(f"  embedded: {product.name_en} ({product.product_id})")

        await db.commit()
        print("Done.")


if __name__ == "__main__":
    asyncio.run(main())
