import uuid

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

from app.database import Base
from app.models.db_models import Product, Store

import os
import socket
import uuid

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

from app.database import Base
from app.models.db_models import Product, Store

TEST_DATABASE_URL = os.environ.get(
    "TEST_DATABASE_URL", "postgresql+asyncpg://user:password@localhost:5432/retailspeak_test"
)


def _is_postgres_reachable(host: str = "localhost", port: int = 5432) -> bool:
    try:
        with socket.create_connection((host, port), timeout=0.2):
            return True
    except OSError:
        return False


_PG_RUNNING = _is_postgres_reachable()


@pytest_asyncio.fixture
async def db_session():
    if not _PG_RUNNING:
        pytest.skip(f"PostgreSQL test database not running on port 5432 (skipping DB-backed tests)")

    engine = create_async_engine(TEST_DATABASE_URL)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    async with session_factory() as session:
        yield session

    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
        await engine.dispose()
    except Exception:
        pass


@pytest_asyncio.fixture
async def sample_store_and_products(db_session):
    store = Store(store_id=uuid.uuid4(), name="Test Store")
    db_session.add(store)
    await db_session.flush()

    rice = Product(
        store_id=store.store_id,
        name_en="Basmati Rice 1kg",
        name_roman_ur="basmati chawal",
        unit="kg",
        price=320.00,
        in_stock_qty=100,
        max_order_qty=20,
        embedding=[0.1] * 384,
    )
    eggs = Product(
        store_id=store.store_id,
        name_en="Eggs (Dozen)",
        name_roman_ur="anda",
        unit="dozen",
        price=360.00,
        in_stock_qty=50,
        max_order_qty=10,
        embedding=[0.2] * 384,
    )
    db_session.add_all([rice, eggs])
    await db_session.commit()

    return store, [rice, eggs]
