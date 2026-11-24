"""Order builder tests with a simulated LLM (no network, no database)."""
import asyncio
import json
import uuid
from types import SimpleNamespace

import pytest

from app.services import llm_grounding_service as lg
from app.services import order_builder_service as ob

STORE = uuid.UUID("11111111-1111-1111-1111-111111111111")


def prod(name, price, max_qty=50, unit="pcs", active=True):
    return SimpleNamespace(
        product_id=uuid.uuid4(), store_id=STORE, name_en=name, unit=unit,
        price=price, in_stock_qty=100, max_order_qty=max_qty, is_active=active,
    )


class FakeScalars(list):
    def all(self):
        return list(self)


class FakeResult:
    def __init__(self, rows):
        self._rows = rows

    def scalars(self):
        return FakeScalars(self._rows)


class FakeDB:
    def __init__(self, products):
        self.products = products

    async def execute(self, _stmt):
        return FakeResult(self.products)


def item(mention, products, match_type="exact", score=1.0, size_hint=None):
    return {
        "mention": mention, "match_type": match_type, "score": score,
        "product_names": [p.name_en for p in products],
        "product_ids": [str(p.product_id) for p in products],
        "ambiguous": len(products) > 1, "size_hint": size_hint,
    }


@pytest.fixture
def fake_llm(monkeypatch):
    """Lets each test script exactly what the 'LLM' returns and inspect what it was shown."""
    state = {"reply": {"lines": []}, "calls": [], "fail": False}

    async def primary(messages, tool_schema):
        state["calls"].append((messages, tool_schema))
        if state["fail"]:
            raise RuntimeError("llm down")
        return state["reply"]

    async def fallback(messages, tool_schema):
        if state["fail"]:
            raise RuntimeError("llm down")
        return state["reply"]

    monkeypatch.setattr(lg, "_call_primary", primary)
    monkeypatch.setattr(lg, "_call_fallback", fallback)
    return state


def run(coro):
    return asyncio.run(coro)


def build(db, items, transcript="x", **kw):
    return run(ob.build_order(db, session_id="s1", store_id=STORE, transcript=transcript,
                              items=items, write_file=False, **kw))


def test_clear_item_with_quantity(fake_llm):
    milk = prod("Haleeb Milk 1L", 320)
    fake_llm["reply"] = {"lines": [{"raw_mention": "haleeb milk", "decision": "select",
                                    "product_id": str(milk.product_id), "quantity": 2, "note": "thanda"}]}
    r = build(FakeDB([milk]), [item("haleeb milk", [milk])], "do haleeb milk thanda")
    assert r["status"] == "ready_to_confirm" and r["blocks_confirmation"] is False
    line = r["order"]["lines"][0]
    assert line["matched_name"] == "Haleeb Milk 1L" and line["quantity"] == 2
    assert line["note"] == "thanda" and line["line_total"] == 640 and r["subtotal"] == 640


def test_ambiguity_becomes_structured_clarification(fake_llm):
    rice = [prod(f"Rice {i}kg", 100 * i) for i in (1, 5, 10)]
    fake_llm["reply"] = {"lines": [{"raw_mention": "rice", "decision": "clarify", "quantity": 2,
                                    "clarification_question": "Which rice: 1kg, 5kg or 10kg?"}]}
    r = build(FakeDB(rice), [item("rice", rice)], "I need two kilo of rice")
    assert r["status"] == "needs_clarification" and r["blocks_confirmation"] is True
    assert r["order"] is None
    c = r["clarifications"][0]
    assert c["question"] == "Which rice: 1kg, 5kg or 10kg?" and c["requested_quantity"] == 2
    assert [o["name"] for o in c["options"]] == [p.name_en for p in rice]
    assert {o["product_id"] for o in c["options"]} == {str(p.product_id) for p in rice}


def test_missing_question_gets_default(fake_llm):
    rice = [prod("Rice A", 1), prod("Rice B", 2)]
    fake_llm["reply"] = {"lines": [{"raw_mention": "rice", "decision": "clarify"}]}
    r = build(FakeDB(rice), [item("rice", rice)])
    assert "rice" in r["clarifications"][0]["question"].lower()
    assert r["clarifications"][0]["requested_quantity"] == 1.0


def test_llm_cannot_use_another_mentions_product(fake_llm):
    milk, sugar = prod("Milk 1L", 300), prod("Sugar 1kg", 150)
    fake_llm["reply"] = {"lines": [
        {"raw_mention": "milk", "decision": "select", "product_id": str(sugar.product_id), "quantity": 1},
        {"raw_mention": "sugar", "decision": "select", "product_id": str(sugar.product_id), "quantity": 1},
    ]}
    r = build(FakeDB([milk, sugar]), [item("milk", [milk]), item("sugar", [sugar])])
    names = [l["matched_name"] for l in r["order"]["lines"]]
    assert names == ["Sugar 1kg"]          # only the legitimate pick survives
    assert r["not_found"] == ["milk"] and r["status"] == "partially_resolved"


def test_invented_product_id_is_rejected(fake_llm):
    milk = prod("Milk 1L", 300)
    fake_llm["reply"] = {"lines": [{"raw_mention": "milk", "decision": "select",
                                    "product_id": str(uuid.uuid4()), "quantity": 1}]}
    r = build(FakeDB([milk]), [item("milk", [milk])])
    assert r["order"] is None and r["not_found"] == ["milk"] and r["status"] == "nothing_found"


def test_renamed_mention_fails_safe(fake_llm):
    milk = prod("Milk 1L", 300)
    fake_llm["reply"] = {"lines": [{"raw_mention": "MILK!!", "decision": "select",
                                    "product_id": str(milk.product_id), "quantity": 1}]}
    r = build(FakeDB([milk]), [item("milk", [milk])])
    assert r["order"] is None


@pytest.mark.parametrize("bad", [None, 0, -3, "abc"])
def test_bad_quantity_falls_back_to_one(fake_llm, bad):
    milk = prod("Milk 1L", 300)
    fake_llm["reply"] = {"lines": [{"raw_mention": "milk", "decision": "select",
                                    "product_id": str(milk.product_id), "quantity": bad}]}
    r = build(FakeDB([milk]), [item("milk", [milk])])
    assert r["order"]["lines"][0]["quantity"] == 1.0


def test_quantity_over_max_is_blocked_by_gate(fake_llm):
    milk = prod("Milk 1L", 300, max_qty=5)
    fake_llm["reply"] = {"lines": [{"raw_mention": "milk", "decision": "select",
                                    "product_id": str(milk.product_id), "quantity": 99}]}
    r = build(FakeDB([milk]), [item("milk", [milk])])
    assert r["status"] == "validation_failed" and r["order"] is None
    assert r["validation_errors"][0]["code"] == "quantity_exceeds_max"


def test_inactive_or_unknown_products_are_never_candidates(fake_llm):
    ghost = prod("Ghost Product", 10)
    r = build(FakeDB([]), [item("ghost", [ghost])])   # DB does not contain it
    assert fake_llm["calls"], "LLM is still asked, but with an empty candidate list"
    cands = fake_llm["calls"][0][1]["function"]["parameters"]["properties"]["lines"]["items"]["properties"]
    assert str(ghost.product_id) not in cands["product_id"]["enum"]


def test_no_items_skips_llm(fake_llm):
    r = build(FakeDB([]), [], "pizza please")
    assert r["status"] == "nothing_found" and r["reason"] == "no_catalog_match"
    assert fake_llm["calls"] == []


def test_llm_down_fails_closed(fake_llm):
    milk = prod("Milk 1L", 300)
    fake_llm["fail"] = True
    r = build(FakeDB([milk]), [item("milk", [milk])])
    assert r["status"] == "llm_unavailable" and r["order"] is None and r["blocks_confirmation"]


def test_llm_sees_only_bounded_data(fake_llm):
    milk, sugar = prod("Milk 1L", 300), prod("Sugar 1kg", 150)
    fake_llm["reply"] = {"lines": []}
    build(FakeDB([milk, sugar]), [item("milk", [milk]), item("sugar", [sugar])], "milk aur sugar")
    messages, schema = fake_llm["calls"][0]
    props = schema["function"]["parameters"]["properties"]["lines"]["items"]["properties"]
    assert set(props["product_id"]["enum"]) == {str(milk.product_id), str(sugar.product_id), None}
    assert props["raw_mention"]["enum"] == ["milk", "sugar"]
    user = messages[1]["content"]
    assert "milk aur sugar" in user and "Milk 1L" in user


def test_duplicate_mentions_get_unique_keys(fake_llm):
    a, b = prod("Tea A", 1), prod("Tea B", 2)
    fake_llm["reply"] = {"lines": []}
    build(FakeDB([a, b]), [item("tea", [a]), item("tea", [b])])
    props = fake_llm["calls"][0][1]["function"]["parameters"]["properties"]["lines"]["items"]["properties"]
    assert props["raw_mention"]["enum"] == ["tea", "tea (2)"]


def test_candidates_are_capped(fake_llm):
    many = [prod(f"Drink {i}", i + 1) for i in range(17)]
    fake_llm["reply"] = {"lines": []}
    build(FakeDB(many), [item("drink", many)])
    props = fake_llm["calls"][0][1]["function"]["parameters"]["properties"]["lines"]["items"]["properties"]
    assert len([x for x in props["product_id"]["enum"] if x]) == ob.MAX_CANDIDATES


def test_file_is_written_and_valid_json(fake_llm, tmp_path, monkeypatch):
    monkeypatch.setattr(ob, "ORDERS_DIR", tmp_path)
    milk = prod("Milk 1L", 300)
    fake_llm["reply"] = {"lines": [{"raw_mention": "milk", "decision": "select",
                                    "product_id": str(milk.product_id), "quantity": 3}]}
    r = run(ob.build_order(FakeDB([milk]), session_id="abc/../evil", store_id=STORE,
                           transcript="teen milk", items=[item("milk", [milk])]))
    data = json.loads((tmp_path / "latest_order.json").read_text(encoding="utf-8"))
    assert data["order"]["lines"][0]["quantity"] == 3
    assert ".." not in r["file"].split("orders")[-1] and "/" not in r["file"].split(str(tmp_path))[-1].lstrip("/\\")