"""
Unit tests for the non-LLM extraction layer (TDD §2.3, PRD §6.1, and Customer Pain Points).

Pure functions, zero DB/network required.
"""
from app.services.nlu_extraction_service import extract_mentions
from app.utils.numeral_normalization import extract_quantity_unit_size, normalize_quantity_unit


def test_normalize_do_kilo():
    qty, unit = normalize_quantity_unit("do kilo")
    assert qty == 2
    assert unit == "kg"


def test_normalize_ek_dozen():
    qty, unit = normalize_quantity_unit("ek dozen")
    assert qty == 1
    assert unit == "dozen"


def test_normalize_digit_with_unit():
    qty, unit = normalize_quantity_unit("2kg")
    assert qty == 2
    assert unit == "kg"


def test_normalize_paao():
    qty, unit = normalize_quantity_unit("paao chawal")
    assert qty == 0.25


def test_extract_mentions_multi_item_roman_urdu():
    intent, mentions = extract_mentions("do kilo chawal aur ek dozen anda")

    assert intent == "add_item"
    assert len(mentions) == 2
    assert mentions[0].raw_mention == "chawal"
    assert mentions[0].quantity_hint == 2
    assert mentions[0].unit_hint == "kg"
    assert mentions[1].raw_mention == "anda"
    assert mentions[1].quantity_hint == 1
    assert mentions[1].unit_hint == "dozen"


def test_extract_mentions_confirm_intent_short_circuits():
    intent, mentions = extract_mentions("haan theek hai")
    assert intent == "confirm"
    assert mentions == []


def test_extract_mentions_cancel_intent():
    intent, mentions = extract_mentions("nahi cancel kar do")
    assert intent == "cancel"
    assert mentions == []


def test_extract_mentions_english_mixed():
    intent, mentions = extract_mentions("2 kg rice and 1 dozen eggs please")
    assert intent == "add_item"
    assert len(mentions) == 2


# =====================================================================
# Tests for Specific User Request & Customer Pain Points
# =====================================================================


def test_multi_product_ata_and_olpers_milk():
    """
    User Request: 'multiple product like 1 kilo ata, 2 olpher milk etc there are
    two products having different quantity and brand and intent'.
    """
    intent, mentions = extract_mentions("1 kilo ata, 2 olpher milk")

    assert intent == "add_item"
    assert len(mentions) == 2

    # Product 1: 1 kilo ata
    atta = mentions[0]
    assert atta.product_name == "ata"
    assert atta.quantity_hint == 1.0
    assert atta.unit_hint == "kg"
    assert atta.confidence >= 0.90

    # Product 2: 2 olpher milk
    milk = mentions[1]
    assert milk.brand == "Olper's"
    assert milk.product_name == "milk"
    assert milk.quantity_hint == 2.0
    assert milk.unit_hint == "litre"
    assert milk.confidence >= 0.90


def test_quantity_formatting_two_1_liter_sprite():
    """
    Customer Pain Point #5: "two 1-liter bottles of Sprite" was previously
    concatenated into 21 liters. Must extract count=2, unit='bottle', size='1-liter'.
    """
    qty, unit, size, text = extract_quantity_unit_size("two 1-liter bottles of Sprite")
    assert qty == 2.0
    assert unit == "bottle"
    assert size == "1-liter"
    assert "Sprite" in text

    intent, mentions = extract_mentions("two 1-liter bottles of Sprite")
    assert len(mentions) == 1
    assert mentions[0].brand == "Sprite"
    assert mentions[0].quantity_hint == 2.0
    assert mentions[0].unit_hint == "bottle"
    assert mentions[0].size_or_volume == "1-liter"


def test_brand_with_number_7up():
    """
    Customer Pain Point #5: '7UP' was previously parsed as 7 regular sodas.
    The digit 7 belongs to the brand name, not quantity.
    """
    intent1, mentions1 = extract_mentions("7UP")
    assert len(mentions1) == 1
    assert mentions1[0].brand == "7UP"
    assert mentions1[0].quantity_hint == 1.0  # NOT 7!

    intent2, mentions2 = extract_mentions("2 7UP")
    assert len(mentions2) == 1
    assert mentions2[0].brand == "7UP"
    assert mentions2[0].quantity_hint == 2.0


def test_deal_pattern_four_for_four_not_44_items():
    """
    Customer Pain Point #5: 'four for four' meal deal added 44 individual items.
    """
    qty, unit, size, text = extract_quantity_unit_size("four for four deal")
    assert qty != 44.0


def test_customizations_extraction():
    """
    Customer Pain Point #2: Inability to handle customizations
    ('burger with no onions, extra pickles, sauce on the side').
    """
    intent, mentions = extract_mentions("zinger burger with no onions and extra pickles")
    assert len(mentions) == 1
    assert mentions[0].product_name == "burger"
    assert "no onions" in mentions[0].customizations
    assert "extra pickles" in mentions[0].customizations


def test_drop_fries_removal_intent():
    """
    Customer Pain Point #2: 'actually, drop the fries' added a second order of fries.
    Must recognize item-level removal and overall remove_item intent.
    """
    intent, mentions = extract_mentions("actually drop the fries")
    assert intent == "remove_item"
    assert len(mentions) == 1
    assert mentions[0].product_name == "fries"
    assert mentions[0].item_intent == "remove"


def test_mid_sentence_correction():
    """
    Customer Pain Point #2: Mid-sentence mind changes
    ('do olper milk nahi ek olper milk kar do').
    """
    intent, mentions = extract_mentions("do olper milk nahi ek olper milk kar do")
    assert len(mentions) == 1
    assert mentions[0].brand == "Olper's"
    assert mentions[0].quantity_hint == 1.0  # successfully updated to 1
    assert mentions[0].item_intent == "modify"


def test_no_human_fallback_trap():
    """
    Customer Pain Point #6: User saying 'operator' or 'talk to human' gets trapped
    in endless loops. System must detect human_fallback intent.
    """
    intent, mentions = extract_mentions("operator please, talk to human")
    assert intent == "human_fallback"
    assert mentions == []


def test_background_noise_and_filler_filtering():
    """
    Customer Pain Point #4: Background speech / filler tokens creating bogus items.
    """
    intent, mentions = extract_mentions("umm uhh bhai sunain mujhe ek kilo ata chahiye please")
    assert intent == "add_item"
    assert len(mentions) == 1
    assert mentions[0].product_name == "ata"
    assert mentions[0].quantity_hint == 1.0
    assert mentions[0].unit_hint == "kg"
