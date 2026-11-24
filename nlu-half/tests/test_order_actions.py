"""Add / remove / reduce / set_quantity, confirm & cancel commands, the evidence rule,
and the exact conversation from the bug report (simulated LLM)."""
import asyncio
import json
import uuid

import pytest

from app.services import llm_grounding_service as lg
from app.services import order_builder_service as ob
from app.services import order_dialog_service as od
from tests.test_order_dialog import FakeDB, FakeStore, STORE, item, prod


@pytest.fixture
def llm(monkeypatch):
    st = {"ground": [], "resolve": [], "calls": [], "fail": False}

    async def call(messages, schema):
        name = schema["function"]["name"]
        st["calls"].append(name)
        queue = st["resolve"] if name == lg._RESOLVE_TOOL_NAME else st["ground"]
        return queue.pop(0) if queue else {"lines": [], "resolutions": []}

    monkeypatch.setattr(lg, "_call_primary", call)
    monkeypatch.setattr(lg, "_call_fallback", call)
    return st


class World:
    def __init__(self, products, tmp=None, monkeypatch=None):
        self.db, self.store, self.turn = FakeDB(products), FakeStore(), 0
        if tmp is not None:
            monkeypatch.setattr(ob, "ORDERS_DIR", tmp)

    def say(self, text, items, write_file=False):
        self.turn += 1
        return asyncio.run(od.process_turn(self.db, self.store, session_id="s1", store_id=STORE,
                                           transcript=text, items=items, turn_id=f"t{self.turn}",
                                           write_file=write_file))


def sel(mention, product, qty=1, action="add", note=None):
    return {"raw_mention": mention, "decision": "select", "product_id": str(product.product_id),
            "quantity": qty, "action": action, "note": note}


def names(r):
    return sorted((l["matched_name"], l["quantity"]) for l in (r["order"] or {"lines": []})["lines"])


# ------------------------------------------------------------------ actions


def test_negation_removes_instead_of_adding(llm):
    bottle, eggs = prod("Water Bottle 1L", 450), prod("Eggs (Dozen)", 340)
    w = World([bottle, eggs])
    llm["ground"].append({"lines": [sel("water bottle", bottle, 1), sel("eggs", eggs, 1)]})
    w.say("water bottle and eggs", [item("water bottle", [bottle]), item("eggs", [eggs])])
    llm["ground"].append({"lines": [sel("water bottle 1l", bottle, None, action="remove")]})
    r = w.say("I don't want water Bottle 1L", [item("water bottle 1l", [bottle])])
    assert names(r) == [("Eggs (Dozen)", 1)] and r["changes"] == ["Removed Water Bottle 1L."]
    assert r["status"] == "ready_to_confirm"


def test_reduce_and_set_quantity(llm):
    eggs = prod("Eggs (Dozen)", 340)
    w = World([eggs])
    llm["ground"].append({"lines": [sel("eggs", eggs, 5)]})
    w.say("five eggs", [item("eggs", [eggs])])
    llm["ground"].append({"lines": [sel("eggs", eggs, 2, action="reduce")]})
    assert names(w.say("take out 2 eggs", [item("eggs", [eggs])])) == [("Eggs (Dozen)", 3)]
    llm["ground"].append({"lines": [sel("eggs", eggs, 7, action="set_quantity")]})
    r = w.say("make it 7 eggs", [item("eggs", [eggs])])
    assert names(r) == [("Eggs (Dozen)", 7)] and r["changes"] == ["Set Eggs (Dozen) to 7."]


def test_reducing_to_zero_removes_the_line(llm):
    eggs = prod("Eggs (Dozen)", 340)
    w = World([eggs])
    llm["ground"].append({"lines": [sel("eggs", eggs, 2)]})
    w.say("two eggs", [item("eggs", [eggs])])
    llm["ground"].append({"lines": [sel("eggs", eggs, 5, action="reduce")]})
    r = w.say("remove 5 eggs", [item("eggs", [eggs])])
    assert r["order"] is None and r["status"] == "order_empty"


def test_removing_something_not_ordered_changes_nothing(llm):
    bottle, eggs = prod("Water Bottle 1L", 450), prod("Eggs (Dozen)", 340)
    w = World([bottle, eggs])
    llm["ground"].append({"lines": [sel("eggs", eggs, 1)]})
    w.say("eggs", [item("eggs", [eggs])])
    llm["ground"].append({"lines": [sel("water bottle", bottle, None, action="remove")]})
    r = w.say("no water bottle", [item("water bottle", [bottle])])
    assert names(r) == [("Eggs (Dozen)", 1)] and r["not_in_order"] == ["Water Bottle 1L"]
    assert r["status"] == "partially_resolved"


def test_unknown_action_falls_back_to_add(llm):
    eggs = prod("Eggs (Dozen)", 340)
    w = World([eggs])
    llm["ground"].append({"lines": [{**sel("eggs", eggs, 1), "action": "delete_everything"}]})
    assert names(w.say("eggs", [item("eggs", [eggs])])) == [("Eggs (Dozen)", 1)]


def test_pending_question_remembers_it_was_a_removal(llm):
    rice = [prod("Guard Rice 1kg", 400), prod("Guard Rice 5kg", 1900)]
    eggs = prod("Eggs (Dozen)", 340)
    w = World(rice + [eggs])
    llm["ground"].append({"lines": [sel("rice", rice[0], 1), sel("rice (2)", rice[1], 1)]})
    w.say("rice 1kg and rice 5kg", [item("rice", [rice[0]]), item("rice", [rice[1]])])
    llm["ground"].append({"lines": [{"raw_mention": "rice", "decision": "clarify", "action": "remove",
                                     "clarification_question": "Which rice should I remove?"}]})
    r = w.say("remove the rice", [item("rice", rice)])
    pid = r["clarifications"][0]["pending_id"]
    assert r["clarifications"][0]["action"] == "remove" and len(names(r)) == 2
    llm["resolve"].append({"resolutions": [{"pending_id": pid, "decision": "resolve", "evidence": "5 kg",
                                            "product_id": str(rice[1].product_id)}]})
    r = w.say("the 5 kg one", [])
    assert names(r) == [("Guard Rice 1kg", 1)]


# ------------------------------------------------------------------ evidence rule


def pending_rice(llm):
    rice = [prod("Guard Rice 1kg", 400), prod("Guard Rice 5kg", 1900)]
    w = World(rice)
    llm["ground"].append({"lines": [{"raw_mention": "rice", "decision": "clarify", "quantity": 1}]})
    r = w.say("I need rice", [item("rice", rice)])
    return w, rice, r["clarifications"][0]["pending_id"]


def test_answer_without_quoted_evidence_is_ignored(llm):
    w, rice, pid = pending_rice(llm)
    llm["resolve"].append({"resolutions": [{"pending_id": pid, "decision": "resolve",
                                            "product_id": str(rice[0].product_id)}]})               # no evidence
    r = w.say("thanks a lot", [])
    assert r["order"] is None and len(r["clarifications"]) == 1


def test_evidence_must_really_be_in_the_sentence(llm):
    w, rice, pid = pending_rice(llm)
    llm["resolve"].append({"resolutions": [{"pending_id": pid, "decision": "resolve", "evidence": "the 5 kg one",
                                            "product_id": str(rice[1].product_id)}]})
    r = w.say("what is the weather today", [])                                                      # invented evidence
    assert r["order"] is None and len(r["clarifications"]) == 1


def test_evidence_is_matched_loosely_but_really(llm):
    w, rice, pid = pending_rice(llm)
    llm["resolve"].append({"resolutions": [{"pending_id": pid, "decision": "resolve", "evidence": "five kg wala",
                                            "product_id": str(rice[1].product_id)}]})
    r = w.say("Haan, FIVE KG wala!", [])
    assert names(r) == [("Guard Rice 5kg", 1)]


# ------------------------------------------------------------------ confirm / cancel


@pytest.mark.parametrize("text", ["This is my final order", "that's all", "Thats it, thank you", "bas itna hi",
                                  "confirm my order", "place the order please", "بس اتنا", "آرڈر کنفرم کر دو"])
def test_confirm_phrases(text):
    assert od.detect_turn_intent(text) == "confirm"


@pytest.mark.parametrize("text", ["cancel my order", "clear the cart", "start over", "sab hata do", "آرڈر منسوخ کریں"])
def test_cancel_phrases(text):
    assert od.detect_turn_intent(text) == "cancel_all"


@pytest.mark.parametrize("text", ["I need to confirm if you have milk", "do you have eggs", "add two milk",
                                  "remove the bread", "how much is rice", ""])
def test_ordinary_sentences_are_not_commands(text):
    assert od.detect_turn_intent(text) is None


def test_confirm_writes_the_final_order_and_starts_a_new_one(llm, tmp_path, monkeypatch):
    milk, eggs = prod("Milk 1L", 300), prod("Eggs (Dozen)", 340)
    w = World([milk, eggs], tmp_path, monkeypatch)
    llm["ground"].append({"lines": [sel("milk", milk, 2)]})
    w.say("two milk", [item("milk", [milk])], write_file=True)
    r = w.say("that's all", [], write_file=True)
    assert r["status"] == "confirmed" and r["blocks_confirmation"] is False and r["subtotal"] == 600
    final = json.loads((tmp_path / "confirmed" / "latest_confirmed.json").read_text(encoding="utf-8"))
    assert final["status"] == "confirmed" and final["order"]["lines"][0]["quantity"] == 2
    assert w.store.data["s1"]["draft_order_lines"] == []
    llm["ground"].append({"lines": [sel("eggs", eggs, 1)]})
    r = w.say("one dozen eggs", [item("eggs", [eggs])])
    assert names(r) == [("Eggs (Dozen)", 1)]                       # the confirmed milk is not carried over


def test_confirm_with_an_open_question_is_blocked(llm):
    w, rice, pid = pending_rice(llm)
    calls = len(llm["calls"])
    r = w.say("This is my final order", [])
    assert r["status"] == "needs_clarification" and r["reason"] == "confirm_blocked_by_question"
    assert len(llm["calls"]) == calls                               # decided without asking the LLM
    assert len(w.store.data["s1"]["ambiguous_items"]) == 1


def test_confirm_with_empty_order(llm):
    w = World([prod("Milk 1L", 300)])
    r = w.say("that's all", [])
    assert r["status"] == "nothing_found" and r["reason"] == "empty_order"


def test_confirm_words_next_to_a_product_are_an_order_not_a_command(llm):
    milk = prod("Milk 1L", 300)
    w = World([milk])
    llm["ground"].append({"lines": [sel("milk", milk, 1)]})
    r = w.say("that's all, add milk", [item("milk", [milk])])
    assert r["status"] == "ready_to_confirm" and names(r) == [("Milk 1L", 1)]


def test_cancel_clears_order_and_questions(llm):
    w, rice, pid = pending_rice(llm)
    r = w.say("cancel my order", [])
    assert r["status"] == "cleared" and w.store.data["s1"]["ambiguous_items"] == []
    assert w.store.data["s1"]["draft_order_lines"] == []


# ------------------------------------------------------------------ the conversation from the bug report


def test_bug_report_conversation(llm):
    eggs = prod("Eggs (Dozen)", 340, unit="dozen")
    water = prod("Water Bottle 1L", 450)
    cokes = [prod("Coca-Cola 345ml", 75), prod("Coca-Cola 1.5L", 150), prod("Coca-Cola 2.25L", 200)]
    w = World([eggs, water] + cokes)

    llm["ground"].append({"lines": [sel("egg", eggs, 1)]})
    r = w.say("I need 1 dozen egg", [item("egg", [eggs])])
    assert names(r) == [("Eggs (Dozen)", 1)]

    # "bottle" no longer forms its own mention (matcher fix), so only the coke question is asked
    llm["ground"].append({"lines": [{"raw_mention": "coke", "decision": "clarify", "quantity": 1,
                                     "clarification_question": "Which Coke: 345ml, 1.5L or 2.25L?"}]})
    r = w.say("add 1 coke 1 liter bottle", [item("coke", cokes)])
    assert names(r) == [("Eggs (Dozen)", 1)] and len(r["clarifications"]) == 1

    # "I don't want water bottle": nothing to remove, and it must NOT be added
    llm["ground"].append({"lines": [sel("water bottle 1l", water, None, action="remove")]})
    r = w.say("I don't want water Bottle 1L", [item("water bottle 1l", [water])])
    assert names(r) == [("Eggs (Dozen)", 1)] and r["not_in_order"] == ["Water Bottle 1L"]

    llm["resolve"].append({"resolutions": [{"pending_id": r["clarifications"][0]["pending_id"],
                                            "decision": "resolve", "evidence": "345ml",
                                            "product_id": str(cokes[0].product_id)}]})
    r = w.say("I want 345ml Coke bottle", [item("coke", [cokes[0]])])
    assert names(r) == [("Coca-Cola 345ml", 1), ("Eggs (Dozen)", 1)] and r["clarifications"] == []

    r = w.say("This is my final order", [])
    assert r["status"] == "confirmed" and r["subtotal"] == 415