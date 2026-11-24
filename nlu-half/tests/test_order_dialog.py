"""Multi-turn dialog tests: clarification, resolution and anti-hallucination (simulated LLM)."""
import asyncio
import copy
import uuid
from types import SimpleNamespace

import pytest

from app.services import llm_grounding_service as lg
from app.services import order_dialog_service as od

STORE = uuid.UUID("11111111-1111-1111-1111-111111111111")


def prod(name, price, max_qty=50, unit="pcs"):
    return SimpleNamespace(product_id=uuid.uuid4(), store_id=STORE, name_en=name, unit=unit,
                           price=price, in_stock_qty=100, max_order_qty=max_qty, is_active=True)


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


class FakeStore:
    def __init__(self):
        self.data = {}

    async def init_if_absent(self, sid, store_id, customer_id):
        if sid not in self.data:
            self.data[sid] = {"session_id": sid, "store_id": store_id, "draft_order_lines": [],
                              "ambiguous_items": [], "not_found_items": [], "confirmed": False}
        return copy.deepcopy(self.data[sid])

    async def set(self, sid, state):
        self.data[sid] = copy.deepcopy(state)


def item(mention, products, match_type="exact", score=1.0):
    return {"mention": mention, "match_type": match_type, "score": score,
            "product_names": [p.name_en for p in products],
            "product_ids": [str(p.product_id) for p in products],
            "ambiguous": len(products) > 1, "size_hint": None}


@pytest.fixture
def llm(monkeypatch):
    """Scripted LLM: separate queues for grounding and resolution calls."""
    st = {"ground": [], "resolve": [], "calls": [], "fail": False}

    async def call(messages, schema):
        name = schema["function"]["name"]
        st["calls"].append((name, messages, schema))
        if st["fail"]:
            raise RuntimeError("llm down")
        queue = st["resolve"] if name == lg._RESOLVE_TOOL_NAME else st["ground"]
        return queue.pop(0) if queue else {"lines": [], "resolutions": []}

    monkeypatch.setattr(lg, "_call_primary", call)
    monkeypatch.setattr(lg, "_call_fallback", call)
    return st


class World:
    def __init__(self, products):
        self.db, self.store = FakeDB(products), FakeStore()
        self.turn = 0

    def say(self, text, items, **kw):
        self.turn += 1
        return asyncio.run(od.process_turn(
            self.db, self.store, session_id="s1", store_id=STORE, transcript=text, items=items,
            turn_id=kw.pop("turn_id", f"t{self.turn}"), write_file=False, **kw))


def rice_set():
    return [prod("Guard Basmati Rice 1kg", 400), prod("Guard Basmati Rice 5kg", 1900),
            prod("Kainat Basmati Rice 5kg", 1800)]


def ask_rice(w, rice, qty=2):
    return w.say("I need two kilo of rice", [item("rice", rice)])


def test_full_clarification_flow(llm):
    rice = rice_set()
    w = World(rice)
    llm["ground"].append({"lines": [{"raw_mention": "rice", "decision": "clarify", "quantity": 2,
                                     "clarification_question": "Which rice?"}]})
    r1 = ask_rice(w, rice)
    assert r1["status"] == "needs_clarification" and r1["order"] is None
    pid = r1["clarifications"][0]["pending_id"]

    llm["resolve"].append({"resolutions": [{"pending_id": pid, "decision": "resolve", "evidence": "5 kg",
                                            "product_id": str(rice[1].product_id)}]})
    before = len(llm["calls"])
    r2 = w.say("the 5 kg guard one", [item("guard", rice[:2])])   # overlaps the pending options
    assert r2["status"] == "ready_to_confirm" and r2["clarifications"] == []
    line = r2["order"]["lines"][0]
    assert line["matched_name"] == "Guard Basmati Rice 5kg" and line["quantity"] == 2   # qty kept from turn 1
    assert [c[0] for c in llm["calls"][before:]] == [lg._RESOLVE_TOOL_NAME]   # no second grounding call
    assert w.store.data["s1"]["ambiguous_items"] == []


def test_foreign_product_in_answer_is_rejected(llm):
    rice = rice_set()
    other = prod("Dove Soap", 200)
    w = World(rice + [other])
    llm["ground"].append({"lines": [{"raw_mention": "rice", "decision": "clarify", "quantity": 1}]})
    pid = ask_rice(w, rice)["clarifications"][0]["pending_id"]
    llm["resolve"].append({"resolutions": [{"pending_id": pid, "decision": "resolve", "evidence": "soap",
                                            "product_id": str(other.product_id)}]})
    r = w.say("soap", [item("soap", [other])])
    assert r["order"] is None and r["status"] == "needs_clarification"   # asked again, nothing added
    invented = {"resolutions": [{"pending_id": pid, "decision": "resolve", "evidence": "that one",
                                 "product_id": str(uuid.uuid4())}]}
    llm["resolve"].append(invented)
    r = w.say("that one", [])
    assert r["order"] is None


def test_still_unclear_updates_question(llm):
    rice = rice_set()
    w = World(rice)
    llm["ground"].append({"lines": [{"raw_mention": "rice", "decision": "clarify", "quantity": 1,
                                     "clarification_question": "Which rice?"}]})
    pid = ask_rice(w, rice)["clarifications"][0]["pending_id"]
    llm["resolve"].append({"resolutions": [{"pending_id": pid, "decision": "still_unclear",
                                            "clarification_question": "Guard 1kg or 5kg?"}]})
    r = w.say("guard", [item("guard", rice[:2])])
    assert r["status"] == "needs_clarification" and r["clarifications"][0]["question"] == "Guard 1kg or 5kg?"
    assert r["clarifications"][0]["pending_id"] == pid and len(r["clarifications"]) == 1


def test_cancel_drops_the_item(llm):
    rice = rice_set()
    w = World(rice)
    llm["ground"].append({"lines": [{"raw_mention": "rice", "decision": "clarify"}]})
    pid = ask_rice(w, rice)["clarifications"][0]["pending_id"]
    llm["resolve"].append({"resolutions": [{"pending_id": pid, "decision": "cancel", "evidence": "nahi chahiye"}]})
    r = w.say("nahi chahiye", [])
    assert r["status"] == "nothing_found" and r["clarifications"] == [] and r["order"] is None


def test_unrelated_sentence_keeps_question_and_adds_new_item(llm):
    rice = rice_set()
    eggs = prod("Eggs (Dozen)", 340, unit="dozen")
    w = World(rice + [eggs])
    llm["ground"].append({"lines": [{"raw_mention": "rice", "decision": "clarify", "quantity": 1}]})
    pid = ask_rice(w, rice)["clarifications"][0]["pending_id"]
    llm["resolve"].append({"resolutions": [{"pending_id": pid, "decision": "unrelated"}]})
    llm["ground"].append({"lines": [{"raw_mention": "eggs", "decision": "select",
                                     "product_id": str(eggs.product_id), "quantity": 1}]})
    r = w.say("one dozen eggs", [item("eggs", [eggs])])
    assert r["status"] == "needs_clarification"                       # rice question still open
    assert [l["matched_name"] for l in r["order"]["lines"]] == ["Eggs (Dozen)"]
    assert len(r["clarifications"]) == 1


def test_answer_and_new_item_in_one_sentence(llm):
    rice = rice_set()
    eggs = prod("Eggs (Dozen)", 340, unit="dozen")
    w = World(rice + [eggs])
    llm["ground"].append({"lines": [{"raw_mention": "rice", "decision": "clarify", "quantity": 1}]})
    pid = ask_rice(w, rice)["clarifications"][0]["pending_id"]
    llm["resolve"].append({"resolutions": [{"pending_id": pid, "decision": "resolve", "evidence": "kainat",
                                            "product_id": str(rice[2].product_id)}]})
    llm["ground"].append({"lines": [{"raw_mention": "eggs", "decision": "select",
                                     "product_id": str(eggs.product_id), "quantity": 1}]})
    r = w.say("kainat and one dozen eggs", [item("kainat", [rice[2]]), item("eggs", [eggs])])
    names = sorted(l["matched_name"] for l in r["order"]["lines"])
    assert names == ["Eggs (Dozen)", "Kainat Basmati Rice 5kg"] and r["status"] == "ready_to_confirm"
    # the answer-related mention ("kainat") was NOT offered to the grounding step again
    schema = [c for c in llm["calls"] if c[0] != lg._RESOLVE_TOOL_NAME][-1][2]
    mention_enum = schema["function"]["parameters"]["properties"]["lines"]["items"]["properties"]["raw_mention"]["enum"]
    assert mention_enum == ["eggs"]


def test_new_quantity_in_answer_overrides(llm):
    rice = rice_set()
    w = World(rice)
    llm["ground"].append({"lines": [{"raw_mention": "rice", "decision": "clarify", "quantity": 2}]})
    pid = ask_rice(w, rice)["clarifications"][0]["pending_id"]
    llm["resolve"].append({"resolutions": [{"pending_id": pid, "decision": "resolve", "quantity": 3, "evidence": "1kg",
                                            "product_id": str(rice[0].product_id)}]})
    r = w.say("the 1kg one, make it 3", [])
    assert r["order"]["lines"][0]["quantity"] == 3


def test_model_skipping_a_pending_item_keeps_it_open(llm):
    rice = rice_set()
    w = World(rice)
    llm["ground"].append({"lines": [{"raw_mention": "rice", "decision": "clarify"}]})
    ask_rice(w, rice)
    llm["resolve"].append({"resolutions": []})
    r = w.say("hmm", [])
    assert r["status"] == "needs_clarification" and len(r["clarifications"]) == 1


def test_same_turn_is_idempotent(llm):
    milk = prod("Milk 1L", 300)
    w = World([milk])
    llm["ground"].append({"lines": [{"raw_mention": "milk", "decision": "select",
                                     "product_id": str(milk.product_id), "quantity": 2}]})
    r1 = w.say("two milk", [item("milk", [milk])], turn_id="same")
    calls = len(llm["calls"])
    r2 = w.say("two milk", [item("milk", [milk])], turn_id="same")
    assert r2["reason"] == "already_processed" and len(llm["calls"]) == calls
    assert r2["order"]["lines"][0]["quantity"] == r1["order"]["lines"][0]["quantity"] == 2


def test_same_product_in_two_turns_adds_up(llm):
    milk = prod("Milk 1L", 300)
    w = World([milk])
    for q in (2, 1):
        llm["ground"].append({"lines": [{"raw_mention": "milk", "decision": "select",
                                         "product_id": str(milk.product_id), "quantity": q}]})
        r = w.say("milk", [item("milk", [milk])])
    assert r["order"]["lines"][0]["quantity"] == 3 and r["subtotal"] == 900


def test_validation_failure_rolls_the_turn_back(llm):
    milk = prod("Milk 1L", 300, max_qty=5)
    w = World([milk])
    llm["ground"].append({"lines": [{"raw_mention": "milk", "decision": "select",
                                     "product_id": str(milk.product_id), "quantity": 3}]})
    w.say("three milk", [item("milk", [milk])])
    llm["ground"].append({"lines": [{"raw_mention": "milk", "decision": "select",
                                     "product_id": str(milk.product_id), "quantity": 4}]})
    r = w.say("four more", [item("milk", [milk])])
    assert r["status"] == "validation_failed" and r["reason"] == "turn_rolled_back"
    assert w.store.data["s1"]["draft_order_lines"][0]["quantity"] == 3     # untouched


def test_llm_down_keeps_state(llm):
    rice = rice_set()
    w = World(rice)
    llm["ground"].append({"lines": [{"raw_mention": "rice", "decision": "clarify"}]})
    ask_rice(w, rice)
    llm["fail"] = True
    r = w.say("5 kg guard", [item("guard", rice[:2])])
    assert r["status"] == "llm_unavailable" and len(w.store.data["s1"]["ambiguous_items"]) == 1


def test_prices_are_restamped_from_the_database_each_turn(llm):
    milk = prod("Milk 1L", 300)
    w = World([milk])
    llm["ground"].append({"lines": [{"raw_mention": "milk", "decision": "select",
                                     "product_id": str(milk.product_id), "quantity": 1}]})
    w.say("milk", [item("milk", [milk])])
    milk.price = 350                                                         # price changes between turns
    r = w.say("anything", [], turn_id="later")
    assert r["order"]["lines"][0]["unit_price"] == 350 and r["subtotal"] == 350
    assert "unit_price" not in w.store.data["s1"]["draft_order_lines"][0]   # price never stored in the session


def test_resolve_tool_schema_is_bounded(llm):
    rice = rice_set()
    w = World(rice)
    llm["ground"].append({"lines": [{"raw_mention": "rice", "decision": "clarify"}]})
    pid = ask_rice(w, rice)["clarifications"][0]["pending_id"]
    llm["resolve"].append({"resolutions": [{"pending_id": pid, "decision": "unrelated"}]})
    w.say("hello", [])
    schema = [c for c in llm["calls"] if c[0] == lg._RESOLVE_TOOL_NAME][-1][2]
    props = schema["function"]["parameters"]["properties"]["resolutions"]["items"]["properties"]
    assert props["pending_id"]["enum"] == [pid]
    assert set(props["product_id"]["enum"]) == {str(p.product_id) for p in rice} | {None}