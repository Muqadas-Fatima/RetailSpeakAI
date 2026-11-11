"""100 production-oriented retailer utterance tests for catalog n-gram matching.

Run from the project root:
    python -m pytest tests/test_catalog_ngram.py -v --no-cov

These tests cover catalog-backed English, Urdu, Roman Urdu, mixed-language
orders, multi-item requests, pack sizes, ambiguity, typos, and unrelated speech.
The expected product names are fixed test data; they are not calculated at test time.
"""
import json
from pathlib import Path

import pytest

from app.services.catalog_ngram_service import CatalogIndex, match_products, write_json

CATALOG = Path(__file__).resolve().parent.parent / "data" / "sample_catalog.json"

@pytest.fixture(scope="module")
def index():
    return CatalogIndex.from_catalog_dicts(json.loads(CATALOG.read_text(encoding="utf-8")))

CASES = [
    ('Dairy & Eggs: p0001', 'mujhe olpers doodh 250ml chahiye', ["Olper's Full Cream Milk 250ml"]),
    ('Dairy & Eggs: p0004', 'please add olpers low fat doodh 1l to my grocery order', ["Olper's Low Fat Milk 1L"]),
    ('Dairy & Eggs: p0005', 'milkpak doodh 250ml de dein', ['Nestle MilkPak Milk 250ml']),
    ('Dairy & Eggs: p0008', 'bhai haleeb doodh 1l bhi bhej dena', ['Haleeb Milk 1L']),
    ('Beverages: p0035', 'mujhe tapal danedar 95g chahiye', ['Tapal Danedar Tea 95g']),
    ('Beverages: p0039', 'please add tapal tez dum 190g to my grocery order', ['Tapal Tez Dum Tea 190g']),
    ('Beverages: p0041', 'tapal family mixture 190g de dein', ['Tapal Family Mixture Tea 190g']),
    ('Beverages: p0043', 'bhai lipton yellow label 95g bhi bhej dena', ['Lipton Yellow Label Tea 95g']),
    ('Staples & Grains: p0096', 'mujhe guard basmati chawal 1kg chahiye', ['Guard Super Kernel Basmati Rice 1kg']),
    ('Staples & Grains: p0099', 'please add kainat basmati chawal 1kg to my grocery order', ['Kainat 1121 Basmati Rice 1kg']),
    ('Staples & Grains: p0101', 'falak sella chawal 1kg de dein', ['Falak Sella Rice 1kg']),
    ('Staples & Grains: p0103', 'bhai khula basmati chawal bhi bhej dena', ['Super Kernel Basmati Rice (Loose)']),
    ('Pulses: p0119', 'mujhe masoor ki daal 1kg chahiye', ['Masoor Daal 1kg']),
    ('Pulses: p0120', 'please add moong ki daal 1kg to my grocery order', ['Moong Daal 1kg']),
    ('Pulses: p0121', 'mash ki daal 1kg de dein', ['Mash Daal 1kg']),
    ('Pulses: p0122', 'bhai chana ki daal 1kg bhi bhej dena', ['Chana Daal 1kg']),
    ('Cooking Oil & Ghee: p0127', 'mujhe dalda tel 1l chahiye', ['Dalda Cooking Oil 1L']),
    ('Cooking Oil & Ghee: p0130', 'please add dalda ghee 1kg to my grocery order', ['Dalda Banaspati Ghee 1kg']),
    ('Cooking Oil & Ghee: p0133', 'habib tel 1l de dein', ['Habib Cooking Oil 1L']),
    ('Cooking Oil & Ghee: p0136', 'bhai habib ghee 1kg bhi bhej dena', ['Habib Banaspati Ghee 1kg']),
    ('Spices & Cooking Aids: p0164', 'mujhe shan biryani masala 50g chahiye', ['Shan Biryani Masala 50g']),
    ('Spices & Cooking Aids: p0165', 'please add shan bombay biryani masala 50g to my grocery order', ['Shan Bombay Biryani Masala 50g']),
    ('Spices & Cooking Aids: p0166', 'shan karahi masala 50g de dein', ['Shan Karahi Masala 50g']),
    ('Spices & Cooking Aids: p0167', 'bhai shan nihari masala 50g bhi bhej dena', ['Shan Nihari Masala 50g']),
    ('Noodles, Pasta & Cereal: p0210', 'mujhe knorr chicken noodles 66g chahiye', ['Knorr Chicken Noodles 66g']),
    ('Noodles, Pasta & Cereal: p0212', 'please add maggi noodles 66g to my grocery order', ['Maggi Masala Noodles 66g']),
    ('Noodles, Pasta & Cereal: p0214', 'indomie 70g de dein', ['Indomie Chicken Noodles 70g']),
    ('Noodles, Pasta & Cereal: p0216', 'bhai knorr chicken corn soup 50g bhi bhej dena', ['Knorr Chicken Corn Soup 50g']),
    ('Bakery: p0228', 'mujhe dawn double roti chahiye', ['Dawn Bread Medium', 'Dawn Bread Large', 'Dawn Bread Jumbo']),
    ('Bakery: p0231', 'please add brown double roti to my grocery order', ['Brown Bread Atta']),
    ('Bakery: p0232', 'burger bun 6pcs de dein', ['Burger Buns 6pcs']),
    ('Bakery: p0233', 'bhai pita bread bhi bhej dena', ['Pita Bread Pack']),
    ('Snacks & Confectionery: p0238', 'mujhe sooper biscuit chahiye', ['Peek Freans Sooper Biscuit']),
    ('Snacks & Confectionery: p0239', 'please add gluco biscuit to my grocery order', ['Peek Freans Gluco Biscuit']),
    ('Snacks & Confectionery: p0240', 'rio biscuit de dein', ['Peek Freans Rio Biscuit']),
    ('Snacks & Confectionery: p0241', 'bhai zeera plus biscuit bhi bhej dena', ['Peek Freans Zeera Plus Biscuit']),
    ('Fresh Vegetables: p0275', 'mujhe pyaz chahiye', ['Onion']),
    ('Fresh Vegetables: p0276', 'please add aloo to my grocery order', ['Potato']),
    ('Fresh Vegetables: p0277', 'tamatar de dein', ['Tomato']),
    ('Fresh Vegetables: p0278', 'bhai lehsan bhi bhej dena', ['Garlic']),
    ('Fresh Fruit: p0299', 'mujhe kela chahiye', ['Banana']),
    ('Fresh Fruit: p0300', 'please add kala kulu seb to my grocery order', ['Apple Kala Kulu']),
    ('Fresh Fruit: p0301', 'golden seb de dein', ['Apple Golden']),
    ('Fresh Fruit: p0302', 'bhai malta bhi bhej dena', ['Orange Malta']),
    ('Meat, Chicken & Fish: p0314', 'mujhe murghi poori chahiye', ['Chicken Whole with Skin']),
    ('Meat, Chicken & Fish: p0315', 'please add chicken boneless boti to my grocery order', ['Chicken Boneless Boti']),
    ('Meat, Chicken & Fish: p0316', 'chicken breast de dein', ['Chicken Breast']),
    ('Meat, Chicken & Fish: p0317', 'bhai chicken ran bhi bhej dena', ['Chicken Thigh Leg Piece']),
    ('Frozen & Chilled: p0330', 'mujhe kn nuggets 270g chahiye', ["K&N's Chicken Nuggets 270g"]),
    ('Frozen & Chilled: p0332', 'please add kn seekh kabab 12pcs to my grocery order', ["K&N's Chicken Seekh Kabab 12 Pcs"]),
    ('Frozen & Chilled: p0333', 'kn shami kabab 12pcs de dein', ["K&N's Chicken Shami Kabab 12 Pcs"]),
    ('Frozen & Chilled: p0334', 'bhai mon salwa paratha 5pcs bhi bhej dena', ['Mon Salwa Plain Paratha 5 Pcs', 'Mon Salwa Plain Paratha 20 Pcs']),
    ('Home Care: p0343', 'mujhe surf excel 500g chahiye', ['Surf Excel Washing Powder 500g']),
    ('Home Care: p0346', 'please add ariel 500g to my grocery order', ['Ariel Washing Powder 500g']),
    ('Home Care: p0349', 'bonus tristar 500g de dein', ['Bonus Tristar Washing Powder 500g']),
    ('Home Care: p0352', 'bhai express power 500g bhi bhej dena', ['Express Power Washing Powder 500g']),
    ('Personal Care: p0383', 'mujhe lux sabun chahiye', ['Lux Soap 1 Bar', 'Lux Soap 3 Bars']),
    ('Personal Care: p0385', 'please add safeguard sabun to my grocery order', ['Safeguard Soap 1 Bar', 'Safeguard Soap 3 Bars']),
    ('Personal Care: p0387', 'lifebuoy sabun de dein', ['Lifebuoy Soap 1 Bar', 'Lifebuoy Soap 3 Bars']),
    ('Personal Care: p0389', 'bhai dove sabun bhi bhej dena', ['Dove Soap 1 Bar', 'Dove Soap 3 Bars']),
    ('Baby Care: p0429', 'mujhe pampers diaper chahiye', ['Pampers Diapers Size 2', 'Pampers Diapers Size 3', 'Pampers Diapers Size 4', 'Pampers Diapers Size 5']),
    ('Baby Care: p0433', 'please add molfix diaper to my grocery order', ['Molfix Diapers Size 3', 'Molfix Diapers Size 4']),
    ('Baby Care: p0435', 'huggies diaper de dein', ['Huggies Diapers Size 3', 'Huggies Diapers Size 4']),
    ('Baby Care: p0437', 'bhai cerelac 350g bhi bhej dena', ['Nestle Cerelac Wheat Baby Cereal 350g']),
    ('Pet Care: p0445', 'mujhe whiskas 400g chahiye', ['Whiskas Cat Food Ocean Fish 400g']),
    ('Pet Care: p0447', 'please add pedigree 400g to my grocery order', ['Pedigree Dog Food Chicken 400g']),
    ('Pet Care: p0449', 'cat litter 5kg de dein', ['Cat Litter 5kg']),
    ('Health & Wellness: p0450', 'bhai panadol bhi bhej dena', ['Panadol Tablets 500mg 10 Tablets', 'Panadol Tablets 500mg 20 Tablets']),
    ('Health & Wellness: p0452', 'mujhe panadol extra chahiye', ['Panadol Extra 10 Tablets']),
    ('Health & Wellness: p0453', 'please add disprin to my grocery order', ['Disprin Tablets 10 Tablets']),
    ('Health & Wellness: p0454', 'strepsils de dein', ['Strepsils Lozenges 8 Lozenges']),
    ('Stationery, Kitchen & Electrical: p0462', 'bhai dollar pen bhi bhej dena', ['Ball Pen Pack']),
    ('Stationery, Kitchen & Electrical: p0463', 'mujhe copy chahiye', ['Notebook 200 Pages']),
    ('Stationery, Kitchen & Electrical: p0464', 'please add dixon pencil to my grocery order', ['Pencil Pack']),
    ('Stationery, Kitchen & Electrical: p0465', 'a4 paper de dein', ['A4 Paper Ream']),
    ('Retail mixed scenario 1', 'ek kilo pyaz aur aadha kilo tamatar', ['Onion', 'Tomato']),
    ('Retail mixed scenario 2', 'do kilo aloo aur pao kilo lehsan', ['Potato', 'Garlic']),
    ('Retail mixed scenario 3', 'aadha kilo adrak aur hara dhania', ['Ginger', 'Coriander Leaves']),
    ('Retail mixed scenario 4', 'one panadol and a dettol hand sanitizer', ['Panadol Tablets 500mg 10 Tablets', 'Panadol Tablets 500mg 20 Tablets', 'Dettol Hand Sanitizer 200ml']),
    ('Retail mixed scenario 5', 'ek shan biryani masala aur ek kilo basmati chawal', ['Shan Biryani Masala 50g', 'Guard Super Kernel Basmati Rice 1kg', 'Guard Super Kernel Basmati Rice 5kg', 'Guard Super Kernel Basmati Rice 10kg', 'Kainat 1121 Basmati Rice 1kg', 'Kainat 1121 Basmati Rice 5kg', 'Super Kernel Basmati Rice (Loose)']),
    ('Retail mixed scenario 6', 'do coke aur aik sprite', ['Coca-Cola Soft Drink 345ml', 'Coca-Cola Soft Drink 1.5L', 'Coca-Cola Soft Drink 2.25L', 'Sprite Soft Drink 345ml', 'Sprite Soft Drink 1.5L', 'Sprite Soft Drink 2.25L']),
    ('Retail mixed scenario 7', 'mujhe surf excel 1kg aur vim liquid chahiye', ['Surf Excel Washing Powder 1kg', 'Vim Dishwash Liquid 500ml', 'Vim Dishwash Liquid 1L']),
    ('Retail mixed scenario 8', 'one pack sooper biscuit and one pack prince biscuit', ['Peek Freans Sooper Biscuit', 'Lu Prince Chocolate Biscuit']),
    ('Retail mixed scenario 9', 'chicken boneless boti aur beef keema', ['Chicken Boneless Boti', 'Beef Mince Keema']),
    ('Retail mixed scenario 10', 'aik dozen anday aur bread bhej dein', ['Eggs (Dozen)', 'Dawn Bread Medium', 'Dawn Bread Large', 'Dawn Bread Jumbo', 'Brown Bread Atta']),
    ('Retail mixed scenario 11', '2 litre coca cola', ['Coca-Cola Soft Drink 345ml', 'Coca-Cola Soft Drink 1.5L', 'Coca-Cola Soft Drink 2.25L']),
    ('Retail mixed scenario 12', 'do pampers size 4', ['Pampers Diapers Size 4']),
    ('Retail mixed scenario 13', '1.5 litre olpers milk', ["Olper's Full Cream Milk 1.5L"]),
    ('Urdu script retail 1', 'ایک درجن انڈے دے دیں', ['Eggs (Dozen)']),
    ('Urdu script retail 2', 'مجھے آدھا کلو پیاز چاہیے', ['Onion']),
    ('Urdu script retail 3', 'دو کلو آلو اور ایک کلو ٹماٹر', ['Potato', 'Tomato']),
    ('Urdu script retail 4', 'شان بریانی مصالحہ ایک پیکٹ', ['Shan Biryani Masala 50g']),
    ('Urdu script retail 5', 'پیپسی', ['Pepsi Soft Drink 345ml', 'Pepsi Soft Drink 1.5L', 'Pepsi Soft Drink 2.25L']),
    ('Urdu script retail 6', 'اولپرز دودھ چاہیے', ["Olper's Full Cream Milk 250ml", "Olper's Full Cream Milk 1L", "Olper's Full Cream Milk 1.5L"]),
    ('Unrelated speech rejection 1', 'iphone charger aur laptop chahiye', []),
    ('Unrelated speech rejection 2', 'main ghar ja raha hoon kal milte hain', []),
    ('Unrelated speech rejection 3', 'bhai kya haal hai aap ka sab theek hai', []),
    ('Unrelated speech rejection 4', 'kal school ki meeting hai', []),
    ('Unrelated speech rejection 5', 'please call me after lunch', []),
    ('Unrelated speech rejection 6', 'mujhe weather ka haal batao', []),
]

@pytest.mark.parametrize("case_name, query, expected_names", CASES, ids=[case[0] for case in CASES])
def test_real_world_retailer_queries(index, case_name, query, expected_names):
    result = match_products(query, index)
    assert result["product_names"] == expected_names, (
        f"Case: {case_name}\nQuery: {query}\nMatches: {result['matches']}"
    )

def test_fuzzy_matching_can_be_disabled(index):
    assert match_products("tapl danedr", index, fuzzy=False)["product_names"] == []

def test_generic_product_word_is_reported_as_ambiguous(index):
    result = match_products("ek packet chai", index)
    assert result["matches"][0]["ambiguous"] is True
    assert len(result["product_names"]) > 5

def test_json_output_is_written_and_readable(tmp_path, index):
    result = match_products("anda", index)
    output = write_json(result, tmp_path / "nested" / "result.json")
    assert json.loads(output.read_text(encoding="utf-8"))["product_names"] == ["Eggs (Dozen)"]

def test_index_contains_only_products_from_catalog(index):
    catalog_names = {p["name_en"] for p in json.loads(CATALOG.read_text(encoding="utf-8"))}
    for phrase_entries in index.phrase_to_entries.values():
        assert all(entry.name in catalog_names for entry in phrase_entries)


# ---------------------------------------------------------------------------
# Original regression tests retained from the existing test suite.
# ---------------------------------------------------------------------------
def names(index, query, **kwargs):
    return match_products(query, index, **kwargs)["product_names"]


def test_loose_items_roman_urdu(index):
    assert names(index, "aadha kilo pyaz, ek kilo aloo aur do kilo tamatar") == ["Onion", "Potato", "Tomato"]


def test_quantities_and_filler_ignored(index):
    assert names(index, "mujhe do kilo chicken boneless boti aur aadha kilo beef keema chahiye") == [
        "Chicken Boneless Boti", "Beef Mince Keema"]


def test_urdu_script(index):
    assert names(index, "ایک درجن انڈے") == ["Eggs (Dozen)"]


def test_english_query(index):
    assert names(index, "one panadol and a dettol hand sanitizer") == [
        "Panadol Tablets 500mg 10 Tablets", "Panadol Tablets 500mg 20 Tablets", "Dettol Hand Sanitizer 200ml"]


def test_longest_match_wins(index):
    assert names(index, "ek shan biryani masala") == ["Shan Biryani Masala 50g"]


def test_fuzzy_typos(index):
    result = names(index, "ek tapl danedr")
    assert result and all(name.startswith("Tapal Danedar Tea") for name in result)


def test_fuzzy_can_be_disabled_original(index):
    assert names(index, "tapl danedr", fuzzy=False) == []


@pytest.mark.parametrize("query", [
    "iphone charger aur laptop chahiye",
    "main ghar ja raha hoon kal milte hain",
    "bhai kya haal hai aap ka sab theek hai",
])
def test_unrelated_text_returns_nothing_original(index, query):
    assert names(index, query) == []


def test_generic_word_is_ambiguous(index):
    result = match_products("ek packet chai", index)
    assert result["matches"][0]["ambiguous"] is True
    assert len(result["product_names"]) > 5


def test_size_narrows_variants(index):
    result = names(index, "ek surf excel 1kg aur ek vim liquid")
    assert "Surf Excel Washing Powder 1kg" in result
    assert "Surf Excel Washing Powder 2kg" not in result


def test_size_before_product_and_decimals(index):
    assert names(index, "1.5 litre olpers milk") == ["Olper's Full Cream Milk 1.5L"]


def test_size_word_for_diapers(index):
    assert names(index, "do pampers size 4") == ["Pampers Diapers Size 4"]


def test_size_goes_to_nearest_product_only(index):
    result = names(index, "ek dalda cooking oil 5 litre aur ek dalda ghee")
    assert "Dalda Cooking Oil 5L" in result and "Dalda Cooking Oil 1L" not in result
    assert len([name for name in result if "Ghee" in name]) == 3


def test_unavailable_size_keeps_all_variants(index):
    assert len(names(index, "2 litre coca cola")) == 3


def test_write_json_original(tmp_path, index):
    output = write_json(match_products("anda", index), tmp_path / "x" / "r.json")
    assert json.loads(output.read_text(encoding="utf-8"))["product_names"] == ["Eggs (Dozen)"]
