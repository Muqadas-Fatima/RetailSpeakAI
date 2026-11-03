"""
TDD §2.3 — non-LLM mention/quantity/unit extraction.

Hard constraint (TDD §2.3): this service has NO network egress beyond
returning its output to the caller. It never calls the catalog, RAG, or
any backend service — pure text-in/structured-spans-out. This module
therefore imports only nlu_half.contracts (typed I/O) — never
rag-retrieval-service, llm-grounding-service, or shared.contracts.

Customer Pain Points addressed directly:
1. Multi-product extraction ("1 kilo ata, 2 olpher milk").
2. Quantity and formatting errors ("two 1-liter bottles of Sprite" -> 2 bottles, 1L; "7UP" -> qty 1).
3. Dialect, phonetic variations ("olpher" -> "Olper's", "ata" -> "ata").
4. Mid-sentence corrections ("do olper milk nahi ek olper milk kar do").
5. Customizations ("with no onions and extra pickles").
6. The "No Human Fallback" trap (operator / talk to human).
"""
from __future__ import annotations

import re
from abc import ABC, abstractmethod

from contracts.pipeline_io import ExtractMentionsRequest, ExtractMentionsResponse, ItemMention

_NUMBER_WORDS: dict[str, float] = {
    "one": 1.0, "two": 2.0, "three": 3.0, "four": 4.0, "five": 5.0,
    "six": 6.0, "seven": 7.0, "eight": 8.0, "nine": 9.0, "ten": 10.0,
    "twelve": 12.0, "half": 0.5, "quarter": 0.25,
    "aik": 1.0, "ek": 1.0, "ik": 1.0, "do": 2.0, "teen": 3.0, "tin": 3.0,
    "char": 4.0, "chaar": 4.0, "panch": 5.0, "paanch": 5.0, "chhe": 6.0, "che": 6.0,
    "saat": 7.0, "aath": 8.0, "nau": 9.0, "das": 10.0, "dus": 10.0,
    "barah": 12.0, "bees": 20.0,
    "aadha": 0.5, "adha": 0.5, "paao": 0.25, "pao": 0.25,
    "sawa": 1.25, "derh": 1.5, "dhai": 2.5,
}

_PROTECTED_BRANDS_PATTERNS = [
    r"\b7\s*up\b", r"\b7up\b", r"\bseven\s*up\b", r"\bcoke\s*zero\b",
    r"\bv8\b", r"\bfour\s*for\s*four\b", r"\b4\s*for\s*4\b"
]

_UNIT_ALIASES: dict[str, str] = {
    "kilo": "kg", "kg": "kg", "kilogram": "kg",
    "gram": "g", "grams": "g", "g": "g",
    "litre": "litre", "liter": "litre", "l": "litre",
    "dozen": "pcs",  # TDD §4.2 worked example: "ek dozen anda" -> {qty: 12, unit: "pcs"}
    "darzan": "pcs", "darjan": "pcs",
    "pcs": "pcs", "piece": "pcs", "pieces": "pcs", "dana": "pcs",
    "packet": "packet", "pkt": "packet", "pack": "pack", "packs": "pack",
    "bottle": "bottle", "bottles": "bottle", "botal": "bottle",
    "can": "can", "tin": "tin", "bag": "bag", "bori": "bag",
}

_BRAND_DICTIONARY: dict[str, str] = {
    "olpers": "Olper's", "olper": "Olper's", "olpher": "Olper's", "olfer": "Olper's",
    "milkpak": "MilkPak", "nestle": "Nestle", "dalda": "Dalda", "sufi": "Sufi",
    "tapal": "Tapal", "lipton": "Lipton", "shan": "Shan", "national": "National",
    "sprite": "Sprite", "coke": "Coca Cola", "pepsi": "Pepsi", "7up": "7UP", "7-up": "7UP"
}

_PRODUCT_PHONETIC_MAP: dict[str, str] = {
    "ata": "ata", "aata": "ata", "atta": "ata", "gehu ka atta": "ata",
    "chawal": "chawal", "rice": "chawal", "basmati": "chawal",
    "doodh": "milk", "milk": "milk",
    "anda": "anda", "anday": "anda", "eggs": "anda",
    "cheeni": "cheeni", "sugar": "cheeni",
    "tail": "oil", "oil": "oil", "ghee": "ghee",
    "fries": "fries", "burger": "burger"
}

_CUSTOMIZATION_PATTERNS = [
    (r"\b(?:no|without|bina)\s+(?:onions?|pyaz)\b", "no onions"),
    (r"\b(?:extra|zyada)\s+(?:pickles?|achar)\b", "extra pickles"),
    (r"\b(?:extra|zyada)\s+(?:cheese)\b", "extra cheese"),
    (r"\b(?:sauce\s+on\s+the\s+side|separate\s+sauce)\b", "sauce on the side"),
    (r"\b(?:kam\s+cheeni|less\s+sugar|bina\s+cheeni)\b", "less sugar"),
    (r"\b(?:no\s+ice|bina\s+baraf)\b", "no ice"),
]

_FILLER_WORDS = {
    "umm", "uhh", "achha", "sunain", "bhai", "yaar", "please", "zara",
    "mujhe", "chahiye", "de do", "dedo", "de dein", "daal do", "bhi",
    "toh", "aur", "and", "plus", "sath", "mein", "ka", "ki", "ke",
    "wala", "wali", "actually", "wait", "kar_karo", "karo", "kar", "do"
}


class NLUExtractor(ABC):
    @abstractmethod
    def extract_mentions(self, request: ExtractMentionsRequest) -> ExtractMentionsResponse: ...


class MockRuleBasedExtractor(NLUExtractor):
    def extract_mentions(self, request: ExtractMentionsRequest) -> ExtractMentionsResponse:
        text = request.input_text.strip()
        text_lower = text.lower()

        # Human Fallback check (Customer Complaint #6)
        if any(h in text_lower for h in ["operator", "talk to human", "insan se baat", "agent", "customer service"]):
            return ExtractMentionsResponse(intent="human_fallback", intent_confidence=0.98, mentions=[])

        # Confirm & Cancel checks
        if any(c in text_lower for c in ["cancel order", "rehnay do", "band karo"]):
            return ExtractMentionsResponse(intent="cancel", intent_confidence=0.95, mentions=[])
        if any(c in text_lower for c in ["confirm", "order bhej do", "theek hai confirm"]):
            return ExtractMentionsResponse(intent="confirm", intent_confidence=0.95, mentions=[])

        words = text_lower.split()
        if len(words) <= 3:
            if any(w in {"haan", "han", "yes", "theek hai", "ok", "theek", "sahi hai"} for w in words):
                return ExtractMentionsResponse(intent="confirm", intent_confidence=0.95, mentions=[])
            if any(w in {"nahi", "cancel", "no"} for w in words):
                return ExtractMentionsResponse(intent="cancel", intent_confidence=0.95, mentions=[])

        # Check for mid-sentence correction ("X nahi Y")
        text_processed = re.sub(r"\b(kar|de|nikal|hata|bhej|daal)\s+do\b", r"\1_karo", text, flags=re.I)
        correction_match = re.search(r"^(.*?)\s+\b(?:nahi|nahin|actually|wait)\b\s+(.*)$", text_processed, flags=re.I)
        if correction_match and ("kar_karo" in text_processed or "badal" in text_processed):
            text_processed = correction_match.group(2).strip()

        # Split clauses
        clauses = self._split_clauses(text_processed)
        mentions: list[ItemMention] = []

        overall_intent = "add_item"
        for clause in clauses:
            mention = self._parse_segment(clause)
            if mention is not None:
                mentions.append(mention)
                if mention.item_intent == "remove":
                    overall_intent = "remove_item"
                elif mention.item_intent == "modify" and overall_intent != "remove_item":
                    overall_intent = "modify_item"

        return ExtractMentionsResponse(
            intent=overall_intent,
            intent_confidence=0.95,
            mentions=mentions,
        )

    def _split_clauses(self, text: str) -> list[str]:
        # Split on conjunctions and commas
        splits = re.split(r"(?:\s*,\s*|\s*;\s*|\b(?:aur|and|\+|sath\s+mein)\b)", text, flags=re.I)
        clauses = [s.strip() for s in splits if s.strip()]

        final_clauses = []
        num_keywords = set(_NUMBER_WORDS.keys()) | {str(i) for i in range(1, 100)}

        for c in clauses:
            tokens = c.split()
            if len(tokens) <= 3:
                final_clauses.append(c)
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
                    final_clauses.append(sub_c)

        return final_clauses

    def _parse_segment(self, segment: str) -> ItemMention | None:
        clean_segment = segment.strip()
        if not clean_segment:
            return None

        item_intent = "add"
        if re.search(r"\b(?:drop|remove|nikal|hata|nahi\s+chahiye)\b", clean_segment, re.I):
            item_intent = "remove"
        elif re.search(r"\b(?:badal|change|modify|instead|ki\s+jagah|kar_karo)\b", clean_segment, re.I):
            item_intent = "modify"

        # Customizations
        customs = []
        for pat, label in _CUSTOMIZATION_PATTERNS:
            if re.search(pat, clean_segment, re.I):
                customs.append(label)
                clean_segment = re.sub(pat, " ", clean_segment, flags=re.I).strip()

        # Protect brand names with numbers
        placeholders = {}
        for i, pat in enumerate(_PROTECTED_BRANDS_PATTERNS):
            m = re.search(pat, clean_segment, re.I)
            if m:
                ph = f"__BRAND_TOK_{i}__"
                placeholders[ph] = m.group(0)
                clean_segment = clean_segment[:m.start()] + ph + clean_segment[m.end():]

        # Check compound count + size + container
        compound_re = re.compile(
            r"\b(?P<count>[a-zA-Z]+|\d+(?:\.\d+)?)\s+(?P<size>\d+(?:\.\d+)?\s*(?:-|–|\s*)?(?:liter|litre|l|ml|kg|kilo|gram|g))\s*(?P<container>bottles?|botlein?|botal|cans?|tins?|packs?|packets?|dabbay?|dabba|bori|bags?)\s*(?:of|wali)?\b",
            re.I,
        )
        qty: float | None = None
        unit: str | None = None
        size_vol: str | None = None

        m_comp = compound_re.search(clean_segment)
        if m_comp:
            c_str = m_comp.group("count").lower()
            qty = _NUMBER_WORDS.get(c_str, float(c_str) if c_str.replace(".", "", 1).isdigit() else 1.0)
            size_vol = m_comp.group("size").strip()
            unit = _UNIT_ALIASES.get(m_comp.group("container").lower(), "bottle")
            clean_segment = clean_segment[:m_comp.start()] + " " + clean_segment[m_comp.end():]
        else:
            size_re = re.compile(
                r"\b(?P<val>\d+(?:\.\d+)?)\s*(?:-|–|\s*)?(?P<unit>liter|litre|l|ml|kg|kilo|gram|g|dozen|darzan|pcs|piece|pieces|packet|bag|bori|bottle|botal)\b",
                re.I,
            )
            m_size = size_re.search(clean_segment)
            if m_size:
                val = float(m_size.group("val"))
                unit_raw = m_size.group("unit").lower()
                unit = _UNIT_ALIASES.get(unit_raw, unit_raw)
                qty = val
                clean_segment = clean_segment[:m_size.start()] + " " + clean_segment[m_size.end():]
            else:
                tokens = re.findall(r"\d+(?:\.\d+)?|[a-zA-Z\u0600-\u06FF_]+", clean_segment.lower())
                consumed = set()
                for tok in tokens:
                    if tok.startswith("__brand_tok_"):
                        continue
                    if qty is None:
                        if tok.replace(".", "", 1).isdigit():
                            qty = float(tok)
                            consumed.add(tok)
                            continue
                        if tok in _NUMBER_WORDS:
                            qty = _NUMBER_WORDS[tok]
                            consumed.add(tok)
                            continue
                    if unit is None and tok in _UNIT_ALIASES:
                        unit = _UNIT_ALIASES[tok]
                        consumed.add(tok)

                # Rebuild clean text without consumed numbers/units
                leftover = [t for t in clean_segment.split() if re.sub(r"[^\w\-]", "", t.lower()) not in consumed]
                clean_segment = " ".join(leftover)

        # Restore placeholders
        for ph, orig in placeholders.items():
            clean_segment = clean_segment.replace(ph, orig)

        # Filter filler words
        words = clean_segment.split()
        meaningful = []
        for w in words:
            w_clean = re.sub(r"[^\w\-]", "", w.lower())
            if w_clean and w_clean not in _FILLER_WORDS and w_clean not in _UNIT_ALIASES and w_clean not in _NUMBER_WORDS:
                meaningful.append(w)

        core_text = " ".join(meaningful).strip().lower()
        if not core_text and qty is None:
            return None

        # Brand detection
        brand = None
        for b_key, b_val in _BRAND_DICTIONARY.items():
            if re.search(rf"\b{re.escape(b_key)}\b", core_text):
                brand = b_val
                break

        # Product name detection
        product_name = None
        for p_key, p_val in _PRODUCT_PHONETIC_MAP.items():
            if re.search(rf"\b{re.escape(p_key)}\b", core_text):
                product_name = p_val
                break

        if not product_name:
            if brand:
                brand_key = next((k for k in _BRAND_DICTIONARY if k in core_text), "")
                leftover_text = core_text.replace(brand_key, "").strip()
                product_name = leftover_text if leftover_text else brand.lower()
            else:
                product_name = core_text if core_text else "item"

        if qty is None:
            qty = 1.0

        # TDD §4.2 worked example: "ek dozen anda" -> {qty: 12, unit: "pcs"}
        if unit == "pcs" and re.search(r"\bdozen\b", segment, re.I):
            qty = qty * 12

        if unit is None:
            if product_name in {"milk", "oil"}:
                unit = "litre"
            elif product_name in {"ata", "chawal", "cheeni", "rice"}:
                unit = "kg"
            elif brand in {"Sprite", "7UP", "Coca Cola", "Pepsi"}:
                unit = "bottle"
            else:
                unit = "pcs"

        raw_mention = core_text if core_text else product_name

        conf = 0.95
        if brand and product_name:
            conf = 0.96
        elif product_name in _PRODUCT_PHONETIC_MAP.values():
            conf = 0.94

        return ItemMention(
            raw_mention=raw_mention,
            product_name=product_name,
            brand=brand,
            quantity_hint=qty,
            unit_hint=unit,
            size_or_volume=size_vol,
            customizations=customs,
            item_intent=item_intent,
            confidence=conf,
        )
