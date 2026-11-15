"""
Urdu-script support for the catalog N-gram matcher (pure: no DB, no network).

1. urdu_subphrases()  - every word / word-group inside an Urdu product name is
                        indexed too, so "باسمتی چاول" or "گارڈ" alone matches.
2. URDU_SYNONYMS      - common Urdu spellings of generic words are attached to
                        the products that already carry the Roman alias.
3. prepare_query()    - spoken sizes -> the form the size filter knows:
                        "ون کیجی" -> "1 kg", "پانچ کلو" -> "5 kg".
"""
from __future__ import annotations

import re

_ARABIC_RE = re.compile(r"[\u0600-\u06FF]")
_DIGITS = str.maketrans("٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹", "01234567890123456789")

# Urdu connector words: never the start or end of an indexed sub-phrase
URDU_STOP = {"کا", "کی", "کے", "اور", "سے", "میں", "کو", "پر", "ہے", "اینڈ", "ان", "والا", "والی", "والے"}

# A sub-phrase that would point at more products than this is too generic to index
MAX_SUBPHRASE_PRODUCTS = 40


def has_urdu(text: str) -> bool:
    return bool(_ARABIC_RE.search(text))


def urdu_subphrases(normalized_phrase: str) -> set[str]:
    """'گارڈ باسمتی چاول' -> {'گارڈ', 'باسمتی', 'چاول', 'گارڈ باسمتی', 'باسمتی چاول', ...}"""
    toks = normalized_phrase.split()
    out: set[str] = set()
    for i in range(len(toks)):
        for j in range(i + 1, len(toks) + 1):
            sub = toks[i:j]
            first, last = sub[0], sub[-1]
            if first in URDU_STOP or last in URDU_STOP:
                continue
            if len(first) < 2 or len(last) < 2 or first.isdigit() or last.isdigit():
                continue
            out.add(" ".join(sub))
    return out


# Roman alias already present in the catalog  ->  Urdu spellings customers/Whisper use
URDU_SYNONYMS: dict[str, list[str]] = {
    "rice": ["رائس", "رائز", "رائیس"],
    "chawal": ["چاول"],
    "basmati rice": ["باسمتی رائس", "باسمتی رائز", "باسمتی رائیس", "باسمتی چاول"],
    "basmati chawal": ["باسمتی رائس", "باسمتی رائز", "باسمتی چاول"],
    "milk": ["ملک"],
    "doodh": ["دودھ", "دوده"],
    "milk powder": ["ملک پاؤڈر", "پاؤڈر ملک", "پاوڈر ملک"],
    "powder doodh": ["پاؤڈر دودھ"],
    "yogurt": ["یوگرٹ", "دہی"],
    "dahi": ["دہی", "دھی"],
    "butter": ["بٹر", "مکھن"],
    "makhan": ["مکھن"],
    "cheese": ["چیز", "پنیر"],
    "cream": ["کریم"],
    "bread": ["بریڈ"],
    "double roti": ["ڈبل روٹی"],
    "roti": ["روٹی"],
    "eggs": ["ایگز", "انڈے"],
    "egg": ["انڈا", "ایگ"],
    "anday": ["انڈے"],
    "tea": ["ٹی"],
    "chai": ["چائے", "چاے"],
    "chai patti": ["چائے پتی", "چاے پتی"],
    "coffee": ["کافی"],
    "kaafi": ["کافی"],
    "cold drink": ["کولڈ ڈرنک", "کولڈڈرنک", "کولڈ ڈرنکس"],
    "cold drinks": ["کولڈ ڈرنکس"],
    "soft drink": ["سافٹ ڈرنک"],
    "drink": ["ڈرنک"],
    "cola": ["کولا"],
    "juice": ["جوس"],
    "water": ["واٹر"],
    "pani": ["پانی"],
    "water bottle": ["واٹر بوتل", "پانی کی بوتل"],
    "sharbat": ["شربت"],
    "atta": ["آٹا", "اٹا"],
    "flour": ["فلور"],
    "sugar": ["شوگر"],
    "cheeni": ["چینی"],
    "chini": ["چینی"],
    "namak": ["نمک"],
    "salt": ["سالٹ"],
    "daal": ["دال"],
    "dal": ["دال"],
    "chana": ["چنا", "چنے"],
    "tel": ["تیل"],
    "oil": ["آئل", "آیل", "آئیل"],
    "cooking oil": ["کوکنگ آئل", "کوکنگ آیل"],
    "ghee": ["گھی"],
    "banaspati": ["بناسپتی"],
    "banaspati ghee": ["بناسپتی گھی"],
    "masala": ["مصالحہ", "مسالہ", "مصالحے", "مسالا"],
    "masalah": ["مصالحہ", "مسالہ"],
    "mirch": ["مرچ"],
    "ketchup": ["کیچپ", "کیچ اپ"],
    "tomato sauce": ["ٹماٹو ساس"],
    "honey": ["ہنی", "شہد"],
    "jam": ["جیم", "جام"],
    "noodles": ["نوڈلز", "نوڈل"],
    "noodle": ["نوڈل"],
    "soup": ["سوپ"],
    "pasta": ["پاستا"],
    "biscuit": ["بسکٹ"],
    "biscuits": ["بسکٹس", "بسکٹ"],
    "chips": ["چپس"],
    "chocolate": ["چاکلیٹ", "چاکلیٹس"],
    "candy": ["کینڈی"],
    "dry fruit": ["ڈرائی فروٹ", "ڈرائی فروٹس"],
    "cereal": ["سیریل"],
    "oats": ["اوٹس"],
    "chicken": ["چکن", "مرغی"],
    "gosht": ["گوشت"],
    "mutton": ["مٹن"],
    "keema": ["قیمہ", "کیمہ"],
    "qeema": ["قیمہ"],
    "fish": ["فش", "مچھلی"],
    "machli": ["مچھلی"],
    "ice cream": ["آئس کریم", "آئسکریم"],
    "kabab": ["کباب"],
    "paratha": ["پراٹھا", "پراٹھے"],
    "apple": ["ایپل", "سیب"],
    "seb": ["سیب"],
    "sabun": ["صابن"],
    "shampoo": ["شیمپو", "شمپو"],
    "toothpaste": ["ٹوتھ پیسٹ", "ٹوتھپیسٹ", "پیسٹ"],
    "tooth paste": ["ٹوتھ پیسٹ"],
    "toothbrush": ["ٹوتھ برش", "برش"],
    "washing powder": ["واشنگ پاؤڈر", "واشنگ پاوڈر"],
    "detergent": ["ڈیٹرجنٹ"],
    "powder": ["پاؤڈر", "پاوڈر"],
    "dishwash": ["ڈش واش"],
    "dish liquid": ["ڈش لیکوئڈ"],
    "tissue": ["ٹشو", "ٹشوز"],
    "diaper": ["ڈائپر", "ڈایپر", "پیمپر"],
    "diapers": ["ڈائپرز", "ڈائپر"],
    "sanitary pads": ["سینیٹری پیڈز", "پیڈز"],
    "pads": ["پیڈز"],
    "battery": ["بیٹری"],
    "batteries": ["بیٹریاں", "بیٹری"],
    "bulb": ["بلب"],
    "cake": ["کیک"],
    "goli": ["گولی"],
}

# --------------------------------------------------------------------------- #
# Query preparation: spoken sizes -> "<number> <unit>"
# --------------------------------------------------------------------------- #
_NUMBER_WORDS = {
    "ایک": "1", "ون": "1", "دو": "2", "ٹو": "2", "تین": "3", "تھری": "3",
    "چار": "4", "فور": "4", "پانچ": "5", "فائیو": "5", "چھ": "6", "دس": "10",
    "ڈیڑھ": "1.5", "آدھا": "0.5", "آدھے": "0.5", "ڈھائی": "2.5",
}
_UNIT_WORDS = {
    "کلو": "kg", "کیجی": "kg", "گجی": "kg", "کلوگرام": "kg", "کلوز": "kg", "کلوں": "kg",
    "لیٹر": "l", "لیٹرز": "l", "لٹر": "l", "لیٹرس": "l",
    "گرام": "g", "گرامز": "g", "گرامس": "g",
}
_ML_RE = re.compile(r"ملی\s*(?:لیٹر|لٹر)")
_KG_RE = re.compile(r"\bکے\s*جی\b")


def prepare_query(query: str) -> str:
    """Rewrite spoken sizes so the existing size filter understands them."""
    text = query.translate(_DIGITS)
    text = re.sub(r"(\d)([\u0600-\u06FF])", r"\1 \2", text)   # "5کلو" -> "5 کلو"
    text = re.sub(r"([\u0600-\u06FF])(\d)", r"\1 \2", text)
    text = _ML_RE.sub(" ml ", text)
    text = _KG_RE.sub(" kg ", text)
    out = [_UNIT_WORDS.get(tok, tok) for tok in text.split()]
    # number words become digits only when a unit follows ("ون کیجی" -> "1 kg")
    units = set(_UNIT_WORDS.values()) | {"ml"}
    for i in range(len(out) - 1):
        if out[i] in _NUMBER_WORDS and out[i + 1] in units:
            out[i] = _NUMBER_WORDS[out[i]]
    return " ".join(out)