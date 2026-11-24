"""A bare packaging word must not become a product mention."""
import json
from pathlib import Path

import pytest

from app.services import catalog_ngram_service as c

CATALOG = Path(__file__).resolve().parents[1] / "data" / "sample_catalog.json"


@pytest.fixture(scope="module")
def index():
    return c.CatalogIndex.from_catalog_dicts(json.loads(CATALOG.read_text(encoding="utf-8")))


def mentions(index, text):
    return [m["mention"] for m in c.match_products(text, index)["matches"]]


@pytest.mark.parametrize("text", ["add 1 coke 1 liter bottle", "I want 345ml Coke bottle", "coke bottle",
                                  "do coke ki bottle", "two cans of coke"])
def test_packaging_word_next_to_a_product_is_dropped(index, text):
    found = mentions(index, text)
    assert found and all(m not in ("bottle", "can", "cans") for m in found), found
    assert any("coke" in m for m in found)


def test_water_bottle_still_matches_as_a_phrase(index):
    assert "water bottle" in mentions(index, "I need a water bottle")


def test_bare_packaging_word_alone_still_matches(index):
    assert mentions(index, "I want a bottle") == ["bottle"]       # the only thing the customer named


def test_normal_matching_is_unchanged(index):
    assert mentions(index, "I need 1 dozen egg") == ["egg"]