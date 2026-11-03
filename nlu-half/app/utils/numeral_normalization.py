"""
Numeral/unit normalization — TDD §2.3 & Customer Pain Points #5.

Features:
1. Multilingual cardinal & colloquial numeral parsing (Urdu, Roman Urdu, English, fractions).
2. Protects brand names containing digits (e.g., '7UP', '7-up', 'v8', 'coke zero') from
   being mistakenly extracted as order quantities.
3. Disentangles order count from product volume/size (e.g., "two 1-liter bottles of Sprite"
   yields count=2, size="1-liter", unit="bottle" instead of hallucinating "21 liters").
4. Disentangles deal/combo patterns (e.g., "four for four" -> deal, not 44 items).
"""
from __future__ import annotations

import re

# Comprehensive cardinal and fractional numbers across Urdu (transliterated), Roman Urdu, and English
_NUMBER_WORDS: dict[str, float] = {
    # English cardinals
    "one": 1.0, "two": 2.0, "three": 3.0, "four": 4.0, "five": 5.0,
    "six": 6.0, "seven": 7.0, "eight": 8.0, "nine": 9.0, "ten": 10.0,
    "eleven": 11.0, "twelve": 12.0, "thirteen": 13.0, "fourteen": 14.0,
    "fifteen": 15.0, "sixteen": 16.0, "twenty": 20.0, "half": 0.5, "quarter": 0.25,
    # Roman Urdu & Urdu transliterated cardinals
    "aik": 1.0, "ek": 1.0, "ik": 1.0, "yak": 1.0,
    "do": 2.0, "dou": 2.0,
    "teen": 3.0, "tin": 3.0,
    "char": 4.0, "chaar": 4.0,
    "panch": 5.0, "paanch": 5.0,
    "chhe": 6.0, "che": 6.0, "chhey": 6.0,
    "saat": 7.0,
    "aath": 8.0, "ath": 8.0,
    "nau": 9.0, "no": 9.0,
    "das": 10.0, "dus": 10.0,
    "gyarah": 11.0, "gyara": 11.0,
    "barah": 12.0, "bara": 12.0,
    "terah": 13.0, "tera": 13.0,
    "chaudah": 14.0, "chauda": 14.0,
    "pandrah": 15.0, "pandra": 15.0,
    "solah": 16.0, "sola": 16.0,
    "satrah": 17.0, "satra": 17.0,
    "atharah": 18.0, "athara": 18.0,
    "unnees": 19.0, "unis": 19.0,
    "bees": 20.0, "bis": 20.0,
    "pachees": 25.0, "pachis": 25.0,
    "tees": 30.0, "tis": 30.0,
    "chalees": 40.0,
    "pachas": 50.0,
    "sau": 100.0, "so": 100.0,
    # Colloquial fractions & retail measures
    "aadha": 0.5, "adha": 0.5, "aadhi": 0.5, "adh": 0.5,
    "paao": 0.25, "pao": 0.25, "pawa": 0.25,  # 250g / quarter kg in Pakistani kiryana
    "sawa": 1.25,
    "derh": 1.5, "dedh": 1.5, "dayrh": 1.5,
    "dhai": 2.5, "dhaai": 2.5,
    "ponay": 0.75,
}

# Protected brands that contain digits or number words — MUST NOT be treated as quantities
_PROTECTED_BRANDS_PATTERNS = [
    r"\b7\s*up\b",
    r"\b7up\b",
    r"\bseven\s*up\b",
    r"\bcoke\s*zero\b",
    r"\bpepsi\s*zero\b",
    r"\bv8\b",
    r"\bsuper\s*90\b",
    r"\b3\s*roses\b",
    r"\bfour\s*for\s*four\b",
    r"\b4\s*for\s*4\b",
]

# Canonical unit mapping
_UNIT_ALIASES: dict[str, str] = {
    # Weight
    "kilo": "kg", "kg": "kg", "kilogram": "kg", "kiloo": "kg", "kilos": "kg",
    "gram": "g", "grams": "g", "g": "g", "gm": "g", "gms": "g",
    # Volume
    "litre": "litre", "liter": "litre", "l": "litre", "litres": "litre", "liters": "litre",
    "ml": "ml", "milli": "ml", "milliliter": "ml", "millilitre": "ml",
    # Count / Containers
    "dozen": "dozen", "darzan": "dozen", "darjan": "dozen", "dozens": "dozen",
    "pcs": "pcs", "piece": "pcs", "pieces": "pcs", "peace": "pcs",
    "dana": "pcs", "danay": "pcs", "dane": "pcs",
    "packet": "packet", "pkt": "packet", "packets": "packet",
    "dabba": "pack", "dabbay": "pack", "dabbey": "pack", "box": "pack", "boxes": "pack",
    "pack": "pack", "packs": "pack",
    "bottle": "bottle", "bottles": "bottle", "botal": "bottle", "botlein": "bottle",
    "can": "can", "cans": "can", "tin": "tin", "tins": "tin",
    "bag": "bag", "bags": "bag", "bori": "bag", "thaila": "bag",
}

# Regex for compound: count + size + container (e.g. "two 1-liter bottles of Sprite")
_COMPOUND_QTY_SIZE_CONTAINER_RE = re.compile(
    r"\b(?P<count>[a-zA-Z]+|\d+(?:\.\d+)?)\s+(?P<size>\d+(?:\.\d+)?\s*(?:-|–|\s*)?(?:liter|litre|l|ml|kg|kilo|gram|g))\s*(?P<container>bottles?|botlein?|botal|cans?|tins?|packs?|packets?|dabbay?|dabba|bori|bags?)\s*(?:of|wali|walay)?\b",
    re.IGNORECASE,
)

# Regex for volume or packaging sizes (e.g., "1-liter", "1.5L", "500ml", "500g", "2kg", "1kg", "5kg")
_SIZE_VOLUME_RE = re.compile(
    r"\b(?P<val>\d+(?:\.\d+)?)\s*(?:-|–|\s*)?(?P<unit>liter|litre|l|ml|kg|kilo|gram|g|dozen|darzan|pcs|piece|pieces|packet|bag|bori|bottle|botal)\b",
    re.IGNORECASE,
)


def extract_quantity_unit_size(text: str) -> tuple[float | None, str | None, str | None, str]:
    """
    Disentangles count quantity, package size/volume, and container unit from text.
    Handles Customer Complaint #5 scenarios:
      - "two 1-liter bottles of Sprite" -> qty=2.0, unit="bottle", size="1-liter", remaining="Sprite"
      - "7up" -> qty=None (or 1), unit=None, size=None, remaining="7up" (digit 7 not stolen!)
      - "do kilo ata" -> qty=2.0, unit="kg", size=None, remaining="ata"
      - "2kg" -> qty=2.0, unit="kg", size=None, remaining=""
      - "ek dozen anda" -> qty=1.0, unit="dozen", size=None, remaining="anda"

    Returns:
        (quantity, unit, size_or_volume, cleaned_text)
    """
    cleaned = text.strip()

    # Step 1: Protect brand tokens with numbers (e.g. 7up, 4 for 4) using digit-free placeholders
    placeholders: dict[str, str] = {}
    for i, pattern in enumerate(_PROTECTED_BRANDS_PATTERNS):
        match = re.search(pattern, cleaned, flags=re.IGNORECASE)
        if match:
            placeholder = f"__BRANDTOKEN{chr(65 + i)}__"
            placeholders[placeholder] = match.group(0)
            cleaned = cleaned[:match.start()] + placeholder + cleaned[match.end():]

    # Step 2: Check for compound count + size + container pattern
    compound_match = _COMPOUND_QTY_SIZE_CONTAINER_RE.search(cleaned)
    if compound_match:
        c_str = compound_match.group("count").lower()
        cnt = _NUMBER_WORDS.get(c_str, float(c_str) if c_str.replace(".", "", 1).isdigit() else 1.0)
        size = compound_match.group("size").strip()
        cont_raw = compound_match.group("container").lower()
        cont_unit = _UNIT_ALIASES.get(cont_raw, cont_raw)
        rem = cleaned[:compound_match.start()] + " " + cleaned[compound_match.end():]
        for placeholder, original in placeholders.items():
            rem = rem.replace(placeholder, original)
        return cnt, cont_unit, size, re.sub(r"\s+", " ", rem).strip()

    # Step 3: Check for single size/volume/unit pattern (e.g., "2kg", "1 kilo", "500ml", "1 liter")
    size_match = _SIZE_VOLUME_RE.search(cleaned)
    if size_match:
        val = float(size_match.group("val"))
        unit_raw = size_match.group("unit").lower()
        canonical_unit = _UNIT_ALIASES.get(unit_raw, unit_raw)

        # Check if there is a separate leading number word before it (e.g. "do 1kg...")
        before_text = cleaned[:size_match.start()].strip()
        tokens_before = re.findall(r"\d+(?:\.\d+)?|[a-zA-Z\u0600-\u06FF_]+", before_text.lower())
        lead_qty = None
        for tok in reversed(tokens_before):
            if tok in _NUMBER_WORDS:
                lead_qty = _NUMBER_WORDS[tok]
                break
            elif tok.isdigit():
                lead_qty = float(tok)
                break

        if lead_qty is not None:
            rem = before_text + " " + cleaned[size_match.end():]
            for placeholder, original in placeholders.items():
                rem = rem.replace(placeholder, original)
            return lead_qty, canonical_unit, f"{val}{canonical_unit}", re.sub(r"\s+", " ", rem).strip()

        rem = cleaned[:size_match.start()] + " " + cleaned[size_match.end():]
        for placeholder, original in placeholders.items():
            rem = rem.replace(placeholder, original)
        return val, canonical_unit, None, re.sub(r"\s+", " ", rem).strip()

    # Step 4: Token-level extraction for word numbers + units (e.g., "do kilo", "paao chawal")
    tokens = re.findall(r"\d+(?:\.\d+)?|[a-zA-Z\u0600-\u06FF_]+", cleaned.lower())
    qty: float | None = None
    unit: str | None = None
    consumed_tokens: set[str] = set()

    for tok in tokens:
        if tok.startswith("__brandtoken"):
            continue
        if qty is None:
            if tok.replace(".", "", 1).isdigit():
                qty = float(tok)
                consumed_tokens.add(tok)
                continue
            if tok in _NUMBER_WORDS:
                qty = _NUMBER_WORDS[tok]
                consumed_tokens.add(tok)
                continue
        if unit is None and tok in _UNIT_ALIASES:
            unit = _UNIT_ALIASES[tok]
            consumed_tokens.add(tok)

    # Build clean product description
    remaining_words = []
    for w in cleaned.split():
        w_clean = re.sub(r"[^\w\-_]", "", w.lower())
        if w_clean in placeholders or any(p.lower() == w_clean for p in placeholders):
            remaining_words.append(w)
        elif w_clean not in consumed_tokens:
            remaining_words.append(w)

    final_text = " ".join(remaining_words)
    for placeholder, original in placeholders.items():
        final_text = final_text.replace(placeholder, original)
        final_text = final_text.replace(placeholder.lower(), original)

    final_text = re.sub(r"\s+", " ", final_text).strip()
    return qty, unit, None, final_text


def normalize_quantity_unit(text: str) -> tuple[float | None, str | None]:
    """
    Backwards-compatible helper for (quantity, unit) pair.
    """
    qty, unit, _, _ = extract_quantity_unit_size(text)
    return qty, unit
