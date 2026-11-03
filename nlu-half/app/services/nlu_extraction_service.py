"""
NLU Extraction Layer (non-LLM) — TDD §2.3, PRD §6.1, and Customer Pain Points resolution.

Hard constraint from TDD §2.3:
"This service has no network egress beyond returning its output to the caller —
it never calls the catalog, RAG, or any backend service; it is a pure
text-in/structured-spans-out function."

Customer Pain Points addressed directly:
1. Multi-product extraction ("1 kilo ata, 2 olpher milk"):
   Segments multiple items even without conjunctions, extracting item-specific
   quantity, unit, brand, product name, customizations, and confidence.
2. Quantity and formatting errors:
   - Disentangles count from volume/size ("two 1-liter bottles of Sprite" -> 2 bottles, 1-liter).
   - Protects brand names with numbers ("7UP", "coke zero", "4 for 4") from being
     consumed as order quantities.
3. Accent, dialect, and phonetic normalization:
   Handles Pakistani Roman Urdu / Urdu phonetic spellings (e.g., "olpher" -> "Olper's",
   "ata"/"aata" -> "ata", "doodh" -> "milk").
4. Mid-sentence corrections & item-level intents:
   Recognizes "drop the fries", "actually make that 1 olper milk instead of 2".
5. Customizations extraction:
   Parses "no onions", "extra pickles", "sauce on the side", "kam cheeni", etc.
6. The "No Human Fallback" trap:
   Recognizes "operator", "talk to human", "insan se baat karao", routing directly
   to 'human_fallback' intent to prevent endless robotic reprompt loops.
7. Background noise & filler tolerance:
   Strips conversational fillers ("umm", "uhh", "achha", "sunain", "bhai", "please")
   without corrupting genuine product spans.
"""
from __future__ import annotations

import re
from typing import Any

from app.schemas.nlu import MentionSpan
from app.utils.numeral_normalization import (
    _NUMBER_WORDS,
    _UNIT_ALIASES,
    extract_quantity_unit_size,
)

# Overall turn intents & triggers
_INTENT_PATTERNS: list[tuple[str, list[str]]] = [
    (
        "human_fallback",
        [
            "operator", "talk to human", "human", "insan se baat", "agent",
            "customer care", "customer service", "manager", "talk to person",
            "banday se baat", "kisi insan se", "help me talk to someone"
        ],
    ),
    (
        "cancel",
        [
            "cancel order", "rehnay do", "chor do", "band karo", "kuch nahi chahiye",
            "poora order cancel", "nahi cancel"
        ],
    ),
    (
        "confirm",
        [
            "haan confirm", "theek hai confirm", "yes confirm", "order confirm",
            "order bhej do", "sahi hai theek hai", "order kardo", "final kar do"
        ],
    ),
    (
        "modify_item",
        [
            "badal do", "change kar do", "modify", "update kar do", "make that a",
            "instead of", "ki jagah"
        ],
    ),
    (
        "remove_item",
        [
            "hata do", "nikal do", "remove", "drop the", "drop", "hatao", "nahi chahiye",
            "cancel item", "ye mat daalna"
        ],
    ),
]

_STRICT_CONFIRM_WORDS = {"haan", "han", "yes", "theek hai", "ok", "theek", "sahi hai", "done"}
_STRICT_CANCEL_WORDS = {"nahi", "cancel", "no", "nahin"}

# Common filler words and conversational noise
_FILLER_WORDS = {
    "umm", "uhh", "uh", "um", "achha", "acha", "sunain", "suno", "bhai",
    "bhaiya", "yaar", "please", "zara", "mujhe", "humein", "humain",
    "chahiye", "de do", "dedo", "de dein", "dedein", "daal do", "daaldo",
    "rakh lo", "bhi", "toh", "to", "aur", "and", "plus", "sath", "saath",
    "mein", "main", "ka", "ki", "ke", "wala", "wali", "walay", "wale",
    "ek minute", "wait", "actually", "kar_karo", "karo", "kar", "do",
    "with", "ke sath", "baghair", "without"
}

# Recognized retail brands
_BRAND_DICTIONARY: dict[str, str] = {
    "olpers": "Olper's", "olper": "Olper's", "olpher": "Olper's", "olfer": "Olper's",
    "milkpak": "MilkPak", "nestle": "Nestle", "nido": "Nido", "everyday": "Everyday",
    "nurpur": "Nurpur", "dalda": "Dalda", "sufi": "Sufi", "mezan": "Mezan",
    "habib": "Habib", "tapal": "Tapal", "danedar": "Tapal", "tezdam": "Tapal",
    "lipton": "Lipton", "vital": "Vital", "shan": "Shan", "national": "National",
    "mitchells": "Mitchells", "mitchell's": "Mitchells", "shezan": "Shezan",
    "sunlight": "Sunlight", "surf excel": "Surf Excel", "ariel": "Ariel",
    "bonus": "Bonus", "brite": "Brite", "lux": "Lux", "lifebuoy": "Lifebuoy",
    "dettol": "Dettol", "safeguard": "Safeguard", "colgate": "Colgate",
    "sensodyne": "Sensodyne", "sprite": "Sprite", "coca cola": "Coca Cola",
    "coke": "Coca Cola", "pepsi": "Pepsi", "7up": "7UP", "7-up": "7UP",
    "seven up": "7UP", "fanta": "Fanta", "dew": "Mountain Dew",
    "mountain dew": "Mountain Dew", "pakola": "Pakola", "lays": "Lays",
    "dawn": "Dawn", "bake parlor": "Bake Parlor", "knor": "Knorr", "knorr": "Knorr"
}

# Phonetic / transliteration normalization for staple items
_PRODUCT_PHONETIC_MAP: dict[str, str] = {
    "ata": "ata", "aata": "ata", "atta": "ata", "gehu ka atta": "ata", "gandum atta": "ata",
    "chakki atta": "ata", "flour": "ata", "maida": "maida", "sooji": "sooji", "besan": "besan",
    "chawal": "chawal", "chaawal": "chawal", "rice": "chawal", "basmati": "chawal", "sela": "chawal",
    "doodh": "milk", "dhud": "milk", "milk": "milk", "fresh milk": "milk",
    "anda": "anda", "anday": "anda", "ande": "anda", "egg": "anda", "eggs": "anda",
    "cheeni": "cheeni", "chini": "cheeni", "sugar": "cheeni", "shakar": "cheeni",
    "tail": "oil", "tel": "oil", "oil": "oil", "cooking oil": "oil",
    "ghee": "ghee", "ghi": "ghee", "banaspati": "ghee", "desi ghee": "ghee",
    "chai": "chai", "chaai": "chai", "tea": "chai", "patti": "chai",
    "sabun": "soap", "soap": "soap", "surf": "detergent",
    "roti": "bread", "double roti": "bread", "bread": "bread", "bun": "bun",
    "fries": "fries", "finger chips": "fries", "chips": "fries",
    "burger": "burger", "zinger": "burger", "cheeseburger": "burger",
}

# Customization patterns (Customer Complaint #2)
_CUSTOMIZATION_PATTERNS = [
    (r"\b(?:no|without|bina|baghair)\s+(?:onions?|pyaz)\b", "no onions"),
    (r"\b(?:extra|zyada)\s+(?:pickles?|achar)\b", "extra pickles"),
    (r"\b(?:extra|zyada)\s+(?:cheese)\b", "extra cheese"),
    (r"\b(?:sauce\s+on\s+the\s+side|alagh\s+se\s+sauce|separate\s+sauce)\b", "sauce on the side"),
    (r"\b(?:kam\s+cheeni|less\s+sugar|bina\s+cheeni|sugar\s*free)\b", "less sugar"),
    (r"\b(?:thanda|chilled|bina\s+baraf|no\s+ice)\b", "no ice"),
    (r"\b(?:spicy|tez\s+mirch)\b", "spicy"),
    (r"\b(?:mild|kam\s+mirch)\b", "mild"),
]


def _detect_turn_intent(text: str) -> tuple[str, float]:
    """Determine turn-level intent and its confidence."""
    text_lower = text.strip().lower()

    for intent, triggers in _INTENT_PATTERNS:
        for trig in triggers:
            if re.search(rf"\b{re.escape(trig)}\b", text_lower):
                return intent, 0.98

    words = text_lower.split()
    if len(words) <= 3:
        if any(w in _STRICT_CONFIRM_WORDS for w in words):
            return "confirm", 0.95
        if any(w in _STRICT_CANCEL_WORDS for w in words):
            return "cancel", 0.95

    return "add_item", 0.92


def _extract_item_from_clause(clause: str, attached_customizations: list[str] | None = None) -> MentionSpan | None:
    """Parses a single item clause into a structured MentionSpan."""
    clean_clause = clause.strip()
    if not clean_clause:
        return None

    item_intent = "add"
    if re.search(r"\b(?:drop|remove|nikal|hata|nahi\s+chahiye|mat\s+daalna)\b", clean_clause, re.I):
        item_intent = "remove"
    elif re.search(r"\b(?:badal|change|modify|instead|ki\s+jagah|kar_karo)\b", clean_clause, re.I):
        item_intent = "modify"

    # Extract customizations within clause if not already provided
    customizations: list[str] = list(attached_customizations or [])
    for pattern, label in _CUSTOMIZATION_PATTERNS:
        if re.search(pattern, clean_clause, re.IGNORECASE):
            if label not in customizations:
                customizations.append(label)
            clean_clause = re.sub(pattern, " ", clean_clause, flags=re.IGNORECASE).strip()

    # Extract quantity, unit, and size/volume
    qty, unit, size_vol, text_remaining = extract_quantity_unit_size(clean_clause)

    # Filter filler words
    words = text_remaining.split()
    meaningful_words = []
    for w in words:
        w_lower = re.sub(r"[^\w\-]", "", w.lower())
        if w_lower and w_lower not in _FILLER_WORDS and w_lower not in _UNIT_ALIASES and w_lower not in _NUMBER_WORDS:
            meaningful_words.append(w)

    core_text = " ".join(meaningful_words).strip().lower()
    if not core_text and qty is None:
        return None

    # Detect Brand
    detected_brand: str | None = None
    for brand_key, brand_canonical in _BRAND_DICTIONARY.items():
        if re.search(rf"\b{re.escape(brand_key)}\b", core_text):
            detected_brand = brand_canonical
            break

    # Detect Product Name & Phonetic Mapping
    product_name: str | None = None
    for phonetic_key, canonical_prod in _PRODUCT_PHONETIC_MAP.items():
        if re.search(rf"\b{re.escape(phonetic_key)}\b", core_text):
            product_name = canonical_prod
            break

    if not product_name:
        if detected_brand:
            brand_token = next((k for k in _BRAND_DICTIONARY if k in core_text), "")
            leftover = core_text.replace(brand_token, "").strip()
            product_name = leftover if leftover else detected_brand.lower()
        else:
            product_name = core_text if core_text else "item"

    # Default quantities if absent or 0
    if qty is None or qty <= 0:
        qty = 1.0

    # Default unit if known brand/product implies standard unit
    if unit is None:
        if product_name in {"milk", "oil", "cold drink"} or (detected_brand in {"Olper's", "MilkPak"}):
            unit = "litre"
        elif detected_brand in {"Sprite", "Pepsi", "7UP"}:
            unit = "bottle"
        elif product_name in {"ata", "chawal", "cheeni", "rice", "flour"}:
            unit = "kg"

    clean_mention = core_text if core_text else (product_name or "item")

    # Calculate extraction confidence
    confidence = 0.95
    if detected_brand and product_name:
        confidence = 0.96
    elif product_name in _PRODUCT_PHONETIC_MAP.values():
        confidence = 0.94
    elif not core_text:
        confidence = 0.70

    return MentionSpan(
        raw_mention=clean_mention,
        product_name=product_name,
        brand=detected_brand,
        quantity_hint=qty,
        unit_hint=unit,
        size_or_volume=size_vol,
        customizations=customizations,
        item_intent=item_intent,
        confidence=confidence,
    )


def extract_mentions(input_text: str) -> tuple[str, list[MentionSpan]]:
    """
    Pure function: transcript/chat text -> (intent, mentions).
    Zero I/O, zero network egress — adheres to TDD §2.3.
    """
    text_clean = input_text.strip()
    if not text_clean:
        return "add_item", []

    intent, _ = _detect_turn_intent(text_clean)
    if intent in {"human_fallback", "confirm", "cancel"}:
        return intent, []

    # Replace verb "kar do", "de do", etc., so "do" is not treated as number 2
    text_processed = re.sub(r"\b(kar|de|nikal|hata|bhej|daal)\s+do\b", r"\1_karo", text_clean, flags=re.I)

    # Check for mid-sentence correction ("X nahi Y" or "wait, make that X instead")
    correction_match = re.search(r"^(.*?)\s+\b(?:nahi|nahin|actually|wait)\b\s+(.*)$", text_processed, flags=re.I)
    if correction_match and any(w in text_processed for w in ["kar_karo", "badal", "modify", "instead"]):
        text_processed = correction_match.group(2).strip()
        intent = "modify_item"

    # Extract global customizations before splitting clauses so 'and' in customizations doesn't split items
    customs: list[str] = []
    for pat, label in _CUSTOMIZATION_PATTERNS:
        if re.search(pat, text_processed, re.I):
            customs.append(label)
            text_processed = re.sub(pat, " ", text_processed, flags=re.I).strip()

    # Clean dangling 'with' or 'and' from customizations
    text_processed = re.sub(r"\b(?:with|ke\s+sath|baghair|without)\b", " ", text_processed, flags=re.I)
    text_processed = re.sub(r"\b(?:and|aur)\s*$", "", text_processed, flags=re.I).strip()

    # Split into clauses
    splits = re.split(r"(?:\s*,\s*|\s*;\s*|\b(?:aur|and|\+|sath\s+mein)\b)", text_processed, flags=re.I)
    clauses: list[str] = [s.strip() for s in splits if s.strip()]

    all_clauses: list[str] = []
    num_keywords = set(_NUMBER_WORDS.keys()) | {str(i) for i in range(1, 100)}

    for c in clauses:
        tokens = c.split()
        if len(tokens) <= 3:
            all_clauses.append(c)
            continue

        split_indices = [0]
        for idx in range(1, len(tokens)):
            curr = re.sub(r"[^\w]", "", tokens[idx].lower())
            prev = re.sub(r"[^\w]", "", tokens[idx - 1].lower())
            if curr in {"for", "up", "liter", "litre", "kg", "dozen", "pcs", "bottle"}:
                continue
            if prev in {"7", "seven", "v", "3"}:
                continue
            if (curr in num_keywords or curr.isdigit()) and (prev not in num_keywords and not prev.isdigit()):
                split_indices.append(idx)

        split_indices.append(len(tokens))
        for i in range(len(split_indices) - 1):
            sub_c = " ".join(tokens[split_indices[i]:split_indices[i + 1]]).strip()
            if sub_c:
                all_clauses.append(sub_c)

    mentions: list[MentionSpan] = []
    for c in all_clauses:
        span = _extract_item_from_clause(c, attached_customizations=customs if len(all_clauses) == 1 else None)
        if span is not None and (span.product_name or span.brand or span.raw_mention):
            mentions.append(span)

    if intent != "remove_item" and any(m.item_intent == "remove" for m in mentions):
        intent = "remove_item"
    elif intent == "add_item" and any(m.item_intent == "modify" for m in mentions):
        intent = "modify_item"

    return intent, mentions
