"""
Catalog N-gram Matching.

Goal: take the text of a customer's query (already transcribed from voice or
typed in chat) and return ONLY the product names that really exist in the
store catalog. Everything else in the sentence (quantities, units, filler
words, "aur", "please", ...) is ignored.

How it works
------------
1. BUILD (once per store, cached):
   Every catalog phrase (name_en, name_ur, name_roman_ur, each alias) is
   normalized and stored in a dictionary:  "basmati chawal" -> [product, ...]
   We also remember the longest phrase (in words) so we know the biggest
   n-gram worth generating from a query.

2. MATCH (per query):
   a. Normalize the query and split it into tokens.
   b. Generate every n-gram, longest first (…, trigrams, bigrams, unigrams).
   c. EXACT PASS  - look each n-gram up in the dictionary. When one hits, the
      tokens it covers are "claimed", so "basmati rice" is never also
      reported as "rice". Longest-match-wins.
   d. FUZZY PASS  - for tokens still unclaimed, try the same n-grams with
      rapidfuzz so ASR/typing errors ("basmti chawl") still resolve.
   e. Anything that matches nothing is simply dropped.

3. OUTPUT: a plain dict (JSON-serializable) with the product names.

This module is pure (no DB, no network) so it can be unit-tested directly and
keeps the NLU extraction layer's "no I/O" rule intact. The DB is only touched
by the thin loader in `load_index_for_store`.
"""
from __future__ import annotations

import json
import re
import time
import unicodedata
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable

from rapidfuzz import fuzz, process

from app.services.urdu_support import (
    MAX_SUBPHRASE_PRODUCTS,
    URDU_SYNONYMS,
    has_urdu,
    prepare_query,
    urdu_subphrases,
)

# --------------------------------------------------------------------------- #
# Tunables (move to Settings / per-store config later if you want, same as
# rag_similarity_floor)
# --------------------------------------------------------------------------- #
FUZZY_THRESHOLD = 86          # 0-100. Higher = stricter.
MIN_FUZZY_CHARS = 4           # never fuzzy-match tiny words ("do", "ka", "aur")
MAX_NGRAM_CAP = 6             # safety cap on n-gram length
INDEX_TTL_SECONDS = 300       # rebuild a store's index at most every 5 minutes

# Size/weight tokens inside catalog names, e.g. "Basmati Rice 1kg" -> we also
# index "basmati rice" so a customer who doesn't say "1kg" still matches.
_SIZE_TOKEN_RE = re.compile(
    r"\b\d+(?:\.\d+)?\s*(?:kg|kilo|g|gm|gram|grams|ml|l|ltr|litre|liter|pcs|pc|pack|packet|dozen)\b",
    re.IGNORECASE,
)

# Packaging words. Alone they are not a product ("coke 1 liter bottle" must not
# match a Water Bottle); they only count when nothing else was named.
_GENERIC_PACKAGING_WORDS = {
    "bottle", "bottles", "botal", "bottol", "pack", "packs", "can", "cans", "tin", "tins",
    "box", "boxes", "bag", "bags", "jar", "jars", "carton", "cartons", "pouch", "sachet",
}

# Words that are never product names on their own. They are only used to stop
# the FUZZY pass from matching junk; the exact pass doesn't need them.
_NON_PRODUCT_WORDS = {
    "aur", "and", "plus", "bhi", "ka", "ki", "ke", "se", "mein", "main", "ko",
    "chahiye", "de", "do", "dedo", "dein", "mujhe", "please", "pls", "kilo", "kg",
    "gram", "litre", "liter", "dozen", "packet", "pcs", "piece", "pieces",
    "aik", "ek", "teen", "char", "chaar", "panch", "paanch", "das", "aadha", "paao",
    "the", "a", "an", "of", "i", "want", "need", "give", "me", "some", "add",
    "bhar", "wala", "wali", "hai", "haan", "nahi",
}

_ARABIC_DIACRITICS_RE = re.compile(r"[\u064B-\u065F\u0670\u06D6-\u06ED]")
_PUNCT_RE = re.compile(r"[^\w\s\u0600-\u06FF]", re.UNICODE)
_URDU_DIGITS = str.maketrans("٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹", "01234567890123456789")


# --------------------------------------------------------------------------- #
# Normalization
# --------------------------------------------------------------------------- #
def normalize(text: str) -> str:
    """lowercase, unify unicode, drop Urdu diacritics + punctuation, collapse spaces."""
    text = unicodedata.normalize("NFKC", text).lower()
    text = text.translate(_URDU_DIGITS)
    text = _ARABIC_DIACRITICS_RE.sub("", text)
    text = text.replace("ي", "ی").replace("ك", "ک")  # Arabic -> Urdu letter forms
    text = _PUNCT_RE.sub(" ", text)
    return re.sub(r"\s+", " ", text).strip()


def tokenize(text: str) -> list[str]:
    n = normalize(text)
    return n.split() if n else []


# --------------------------------------------------------------------------- #
# Size helpers: "1kg", "5 litre", "250 ml", "size 4"
# Used to narrow pack-size variants when the customer states a size.
# --------------------------------------------------------------------------- #
_SIZE_RE = re.compile(
    r"(\d+(?:\.\d+)?)\s*(kgs?|kilos?|gm|grams?|g|ml|ltrs?|litres?|liters?|l)\b"
    r"|size\s*(\d+)\b",
    re.IGNORECASE,
)
_UNIT_CANON = {"kg": "kg", "kgs": "kg", "kilo": "kg", "kilos": "kg",
               "g": "g", "gm": "g", "gram": "g", "grams": "g", "ml": "ml",
               "l": "l", "ltr": "l", "ltrs": "l", "litre": "l", "litres": "l",
               "liter": "l", "liters": "l"}
MAX_SIZE_GAP = 2  # a size word may sit at most 2 tokens away from its product


def _canon_number(num: str) -> str:
    return num.rstrip("0").rstrip(".") if "." in num else num


def size_keys(text: str) -> set[str]:
    """'Dalda Cooking Oil 5L' -> {'5l'};  'Pampers Size 4' -> {'size4'}"""
    keys = set()
    for m in _SIZE_RE.finditer(unicodedata.normalize("NFKC", text).lower()):
        if m.group(3):
            keys.add(f"size{m.group(3)}")
        else:
            keys.add(f"{_canon_number(m.group(1))}{_UNIT_CANON[m.group(2)]}")
    return keys


def _size_mentions(query: str) -> list[tuple[int, int, str]]:
    """[(start_token, end_token, key)] for every size the customer said."""
    text = unicodedata.normalize("NFKC", query).lower()
    out = []
    for m in _SIZE_RE.finditer(text):
        start = len(tokenize(text[:m.start()]))
        end = start + len(tokenize(m.group(0)))
        key = f"size{m.group(3)}" if m.group(3) else f"{_canon_number(m.group(1))}{_UNIT_CANON[m.group(2).lower()]}"
        out.append((start, end, key))
    return out


# --------------------------------------------------------------------------- #
# Data classes
# --------------------------------------------------------------------------- #
@dataclass(frozen=True)
class CatalogEntry:
    """One real catalog product. `name` is what we return to the caller."""
    product_id: str
    name: str
    phrases: tuple[str, ...]  # every surface form (en / ur / roman-ur / aliases)


@dataclass
class NgramMatch:
    mention: str              # exact words from the query that matched
    start: int                # token position in the query
    end: int                  # exclusive
    match_type: str           # "exact" | "fuzzy"
    score: float              # 1.0 for exact, else 0-1
    products: list[CatalogEntry] = field(default_factory=list)  # >1 => ambiguous
    size_hint: str | None = None  # size the customer said, e.g. "1kg", if used

    def to_dict(self) -> dict:
        return {
            "mention": self.mention,
            "match_type": self.match_type,
            "score": round(self.score, 3),
            "product_names": [p.name for p in self.products],
            "product_ids": [p.product_id for p in self.products],
            "ambiguous": len(self.products) > 1,
            "size_hint": self.size_hint,
        }


# --------------------------------------------------------------------------- #
# Index
# --------------------------------------------------------------------------- #
class CatalogIndex:
    def __init__(self, entries: Iterable[CatalogEntry]):
        self.phrase_to_entries: dict[str, list[CatalogEntry]] = {}
        self.max_n = 1

        for entry in entries:
            for raw in entry.phrases:
                for variant in self._variants(raw):
                    toks = variant.split()
                    if not toks:
                        continue
                    bucket = self.phrase_to_entries.setdefault(variant, [])
                    if entry not in bucket:
                        bucket.append(entry)
                    self.max_n = max(self.max_n, len(toks))

        self._add_urdu_support()
        self.max_n = min(self.max_n, MAX_NGRAM_CAP)
        # fuzzy candidates grouped by word-count so a 2-word n-gram is only
        # compared to 2-word catalog phrases (fast + more accurate)
        self._phrases_by_len: dict[int, list[str]] = {}
        for phrase in self.phrase_to_entries:
            self._phrases_by_len.setdefault(len(phrase.split()), []).append(phrase)

    def _add_urdu_support(self) -> None:
        """Index Urdu-script words inside product names + Urdu spellings of
        generic words (see urdu_support.py)."""
        # (a) every word / word-group inside an Urdu product name
        extra: dict[str, list[CatalogEntry]] = {}
        for phrase, entries in list(self.phrase_to_entries.items()):
            if not has_urdu(phrase):
                continue
            for sub in urdu_subphrases(phrase):
                if sub in self.phrase_to_entries:
                    continue  # already an exact catalog phrase: keep it as is
                bucket = extra.setdefault(sub, [])
                for entry in entries:
                    if entry not in bucket:
                        bucket.append(entry)
        for sub, entries in extra.items():
            if len(entries) <= MAX_SUBPHRASE_PRODUCTS:
                self.phrase_to_entries[sub] = entries
                self.max_n = max(self.max_n, len(sub.split()))

        # (b) Urdu spellings of generic words -> products with the Roman alias
        for roman, spellings in URDU_SYNONYMS.items():
            entries = self.phrase_to_entries.get(normalize(roman))
            if not entries:
                continue
            for spelling in spellings:
                key = normalize(spelling)
                bucket = self.phrase_to_entries.setdefault(key, [])
                for entry in entries:
                    if entry not in bucket:
                        bucket.append(entry)
                self.max_n = max(self.max_n, len(key.split()))

    @staticmethod
    def _variants(raw: str) -> set[str]:
        """normalized phrase + the same phrase with size tokens removed."""
        full = normalize(raw)
        stripped = normalize(_SIZE_TOKEN_RE.sub(" ", raw))
        return {v for v in (full, stripped) if v}

    @classmethod
    def from_catalog_dicts(cls, products: Iterable[dict]) -> "CatalogIndex":
        """
        products: [{"product_id", "name_en", "name_ur"?, "name_roman_ur"?, "aliases"?}, ...]
        `aliases` may be a list OR a comma/pipe/semicolon separated string.
        """
        entries = []
        for p in products:
            aliases = p.get("aliases") or []
            if isinstance(aliases, str):
                aliases = re.split(r"[,|;]", aliases)
            phrases = [p.get("name_en"), p.get("name_ur"), p.get("name_roman_ur"), *aliases]
            phrases = tuple(x.strip() for x in phrases if x and x.strip())
            if phrases:
                entries.append(CatalogEntry(str(p["product_id"]), p["name_en"], phrases))
        return cls(entries)

    # ------------------------------------------------------------------ #
    def match(self, query: str, fuzzy: bool = True) -> list[NgramMatch]:
        tokens = tokenize(query)
        claimed = [False] * len(tokens)
        matches: list[NgramMatch] = []

        # ---- exact pass: longest n-gram first, left to right ------------- #
        for n in range(min(self.max_n, len(tokens)), 0, -1):
            for i in range(len(tokens) - n + 1):
                if any(claimed[i:i + n]):
                    continue
                gram = " ".join(tokens[i:i + n])
                hit = self.phrase_to_entries.get(gram)
                if hit:
                    matches.append(NgramMatch(gram, i, i + n, "exact", 1.0, list(hit)))
                    for k in range(i, i + n):
                        claimed[k] = True

        # ---- fuzzy pass over what is left -------------------------------- #
        if fuzzy:
            for n in range(min(self.max_n, len(tokens)), 0, -1):
                candidates = self._phrases_by_len.get(n)
                if not candidates:
                    continue
                for i in range(len(tokens) - n + 1):
                    if any(claimed[i:i + n]):
                        continue
                    window = tokens[i:i + n]
                    if all(t in _NON_PRODUCT_WORDS or t.isdigit() for t in window):
                        continue
                    if any(t in _NON_PRODUCT_WORDS or t.isdigit() for t in window):
                        continue  # a fuzzy n-gram must be made of "product-like" words only
                    gram = " ".join(window)
                    if len(gram.replace(" ", "")) < MIN_FUZZY_CHARS:
                        continue
                    best = process.extractOne(gram, candidates, scorer=fuzz.ratio,
                                              score_cutoff=FUZZY_THRESHOLD)
                    if best:
                        phrase, score, _ = best
                        matches.append(NgramMatch(
                            gram, i, i + n, "fuzzy", score / 100.0,
                            list(self.phrase_to_entries[phrase]),
                        ))
                        for k in range(i, i + n):
                            claimed[k] = True

        # a bare packaging word is only a product when it is the only thing named
        generic = {
            id(m) for m in matches
            if m.end - m.start == 1 and tokens[m.start] in _GENERIC_PACKAGING_WORDS
        }
        if generic and len(generic) < len(matches):
            matches = [m for m in matches if id(m) not in generic]

        matches.sort(key=lambda m: m.start)  # keep the order the customer spoke
        self._narrow_by_size(query, matches)
        return matches

    @staticmethod
    def _narrow_by_size(query: str, matches: list[NgramMatch]) -> None:
        """If the customer said a size next to a product ("surf excel 1kg",
        "5 litre dalda oil"), keep only the variants of that size."""
        for s_start, s_end, key in _size_mentions(query):
            best, best_gap = None, MAX_SIZE_GAP + 1
            for m in matches:
                if len(m.products) < 2 or m.size_hint:
                    continue
                gap = max(m.start - s_end, s_start - m.end, 0)
                if gap < best_gap and any(key in size_keys(p.name) for p in m.products):
                    best, best_gap = m, gap
            if best:
                best.products = [p for p in best.products if key in size_keys(p.name)]
                best.size_hint = key


# --------------------------------------------------------------------------- #
# Public helpers
# --------------------------------------------------------------------------- #
def match_products(query: str, index: CatalogIndex, fuzzy: bool = True) -> dict:
    """query text -> JSON-serializable dict containing the matched product names."""
    matches = index.match(prepare_query(query), fuzzy=fuzzy)

    names: list[str] = []
    for m in matches:
        for p in m.products:
            if p.name not in names:
                names.append(p.name)

    return {
        "query": query,
        "product_names": names,                       # <- the main output
        "matches": [m.to_dict() for m in matches],    # <- per-mention detail
    }


def write_json(result: dict, path: str | Path) -> Path:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    return path


# --------------------------------------------------------------------------- #
# Per-store cache + DB loader (the only part that touches the database)
# --------------------------------------------------------------------------- #
_INDEX_CACHE: dict[uuid.UUID, tuple[float, CatalogIndex]] = {}


def invalidate_store_index(store_id: uuid.UUID) -> None:
    """Call after any catalog insert/update (same place you call reindex_product)."""
    _INDEX_CACHE.pop(store_id, None)


async def load_index_for_store(db, store_id: uuid.UUID) -> CatalogIndex:
    from sqlalchemy import select  # local import keeps the pure part DB-free

    from app.models.db_models import Product

    cached = _INDEX_CACHE.get(store_id)
    if cached and time.monotonic() - cached[0] < INDEX_TTL_SECONDS:
        return cached[1]

    rows = (await db.execute(
        select(Product).where(Product.store_id == store_id, Product.is_active.is_(True))
    )).scalars().all()

    index = CatalogIndex.from_catalog_dicts(
        {
            "product_id": p.product_id,
            "name_en": p.name_en,
            "name_ur": p.name_ur,
            "name_roman_ur": p.name_roman_ur,
            "aliases": p.aliases,
        }
        for p in rows
    )
    _INDEX_CACHE[store_id] = (time.monotonic(), index)
    return index