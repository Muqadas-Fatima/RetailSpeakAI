import json
import sys
from pathlib import Path

from app.services.catalog_ngram_service import CatalogIndex, match_products, write_json

ROOT = Path(__file__).resolve().parent.parent
CATALOG = ROOT / "data" / "sample_catalog.json"
OUT = ROOT / "output" / "ngram_matches" / "demo.json"

EXAMPLES = [
    "do kilo basmati chawal aur ek dozen anda",
    "mujhe aadha kilo cheeni aur ek lipton chai chahiye",
    "ek litre dalda oil aur paao bhar basmti chawl",
    "ghee ka tin dedo",
]

if __name__ == "__main__":
    index = CatalogIndex.from_catalog_dicts(json.loads(CATALOG.read_text(encoding="utf-8")))
    queries = [" ".join(sys.argv[1:])] if len(sys.argv) > 1 else EXAMPLES
    for q in queries:
        result = match_products(q, index)
        print(f"\nQUERY : {q}\nNAMES : {result['product_names']}")
    write_json(result, OUT)
    print(f"\nLast result saved to {OUT}")