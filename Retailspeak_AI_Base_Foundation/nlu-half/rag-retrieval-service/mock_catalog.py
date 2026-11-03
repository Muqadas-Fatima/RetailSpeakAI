"""
Phase 1 mocked catalog (Execution Plan §4 Phase 1: "each scaffolded
first as a typed contract with a mocked implementation" — this is that
mock for rag-retrieval-service). Reuses shared.contracts.Product
directly rather than forking a parallel shape, per Plan §1.7.

Models the TDD §6.2 propagation split even though it's a mock, so
swapping this for real Postgres/pgvector later doesn't change any
caller's expectations:
  - price / in_stock_qty / is_active: read fresh on every call here
    (TDD calls these "live-joined at query time" — for the mock that
    just means "read straight off the in-memory Product object," no
    caching layer sits in front of them, matching production's intent).
  - name_en / name_ur / name_roman_ur / aliases: what similarity search
    matches against — the fields that would go through the re-embedding
    queue in production (TDD §6.1–§6.2).

Fixture data reproduces the TDD's own worked example (§4.2/§4.3:
"do kilo chawal aur ek dozen anda" -> Basmati Rice @ 0.88, eggs) plus a
second rice product so the 0.72–0.85 disambiguation band (TDD §6.3) has
something to demonstrate, and deliberately nothing matching "ghee tin"
so the not-found path (TDD §4.4) is exercised too.
"""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID, uuid4

from shared.contracts.catalog import Product

_STORE_ID = UUID("00000000-0000-0000-0000-000000000001")


def _product(**overrides) -> Product:
    defaults = dict(
        product_id=uuid4(),
        store_id=_STORE_ID,
        aliases=[],
        category="grocery",
        embedding_id=uuid4(),
        is_active=True,
        updated_at=datetime.now(timezone.utc),
    )
    defaults.update(overrides)
    return Product(**defaults)


_FIXTURE_PRODUCTS: list[Product] = [
    _product(
        name_en="Basmati Rice",
        name_ur="باسمتی چاول",
        name_roman_ur="chawal",
        aliases=["basmati chawal", "safed chawal"],
        unit="kg",
        price=320.0,
        in_stock_qty=120.0,
        low_stock_threshold=20.0,
    ),
    _product(
        name_en="Sella Rice",
        name_ur="سیلا چاول",
        name_roman_ur="sela chawal",
        aliases=["lal chawal"],  # close-but-not-identical to Basmati -> disambiguation band demo
        unit="kg",
        price=210.0,
        in_stock_qty=80.0,
        low_stock_threshold=20.0,
    ),
    _product(
        name_en="Eggs",
        name_ur="انڈے",
        name_roman_ur="anda",
        aliases=["andy", "eggs"],
        unit="pcs",
        price=22.0,
        in_stock_qty=400.0,
        low_stock_threshold=48.0,
    ),
    _product(
        name_en="Sunflower Oil 1L",
        name_ur="سن فلاور آئل",
        name_roman_ur="sunflower oil",
        aliases=["cooking oil"],
        unit="litre",
        price=650.0,
        in_stock_qty=5.0,
        low_stock_threshold=10.0,  # already below threshold — Phase 3 supplier-reorder fixture
    ),
    _product(
        name_en="Chakki Atta 1kg",
        name_ur="چکی آٹا",
        name_roman_ur="ata",
        aliases=["atta", "aata", "gehu ka atta", "flour"],
        unit="kg",
        price=140.0,
        in_stock_qty=150.0,
        low_stock_threshold=30.0,
    ),
    _product(
        name_en="Olper's Milk 1L",
        name_ur="اولپرز دودھ",
        name_roman_ur="olper milk",
        aliases=["olpher milk", "olpers milk", "olper milk", "olpers doodh", "olper doodh", "olpers", "milk"],
        unit="litre",
        price=290.0,
        in_stock_qty=100.0,
        low_stock_threshold=20.0,
    ),
    _product(
        name_en="Sprite 1L",
        name_ur="سپرائٹ",
        name_roman_ur="sprite",
        aliases=["sprite bottle", "cold drink"],
        unit="bottle",
        price=120.0,
        in_stock_qty=50.0,
        low_stock_threshold=10.0,
    ),
    _product(
        name_en="7UP 500ml",
        name_ur="سیون اپ",
        name_roman_ur="7up",
        aliases=["seven up", "7 up"],
        unit="bottle",
        price=80.0,
        in_stock_qty=60.0,
        low_stock_threshold=15.0,
    ),
    # No "ghee tin" product on purpose — exercises the not-found path.
]


class MockCatalogStore:
    """Phase 1 stand-in for `Product`/`InventoryRecord` live reads (TDD §9.1)."""

    def __init__(self, products: list[Product] | None = None):
        self._products = products if products is not None else list(_FIXTURE_PRODUCTS)

    def active_products_for_store(self, store_id: UUID) -> list[Product]:
        # TDD §6.2: is_active filtered live, no embedding-deletion wait.
        return [p for p in self._products if p.store_id == store_id and p.is_active]


DEFAULT_STORE_ID = _STORE_ID
