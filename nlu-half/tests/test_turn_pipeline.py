"""Typed-text / voice turn pipeline + WebSocket protocol tests (no network, no DB)."""
import asyncio
import json
import uuid
from types import SimpleNamespace

import pytest
from starlette.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from app.services import catalog_ngram_service as cn
from app.services import llm_grounding_service as lg
from app.services import turn_pipeline_service as tp
from tests.test_order_dialog import FakeDB, FakeStore, prod, STORE

# --------------------------------------------------------------------------- reply text


def test_reply_ready():
    r = {"status": "ready_to_confirm", "subtotal": 680.0, "not_found": [], "clarifications": [],
         "order": {"lines": [{"quantity": 2.0, "matched_name": "Haleeb Milk 1L"}]}}
    assert tp.build_reply(r) == "Your order: 2 x Haleeb Milk 1L. Total: Rs 680. Anything else, or shall I confirm?"


def test_reply_question_and_partial():
    r = {"status": "needs_clarification", "subtotal": 340.0, "not_found": ["pizza"],
         "clarifications": [{"question": "Which rice, 1kg or 5kg?"}],
         "order": {"lines": [{"quantity": 1.0, "matched_name": "Eggs (Dozen)"}]}}
    out = tp.build_reply(r)
    assert "1 x Eggs (Dozen)" in out and "Which rice, 1kg or 5kg?" in out and "couldn't find pizza" in out
    assert "shall I confirm" not in out


@pytest.mark.parametrize("status,needle", [
    ("llm_unavailable", "try again"), ("nothing_found", "couldn't find that"),
])
def test_reply_failure_states(status, needle):
    r = {"status": status, "subtotal": 0, "not_found": [], "clarifications": [], "order": None}
    assert needle in tp.build_reply(r)


def test_reply_validation_failed_uses_reason():
    r = {"status": "validation_failed", "validation_errors": [{"reason": "quantity 99 exceeds max 5"}]}
    assert "quantity 99 exceeds max 5" in tp.build_reply(r)


def test_clean_text():
    assert tp.clean_text("  two   milk \n please ") == "two milk please"
    assert tp.clean_text(None) == "" and tp.clean_text(5) == "" and tp.clean_text("   ") == ""


# --------------------------------------------------------------------------- run_turn end to end


def make_catalog():
    milk = prod("Haleeb Milk 1L", 320)
    eggs = prod("Eggs (Dozen)", 340, unit="dozen")
    rows = [
        {"product_id": str(milk.product_id), "name_en": milk.name_en, "name_ur": "حلیب دودھ",
         "name_roman_ur": "haleeb doodh", "aliases": "haleeb milk, haleeb doodh"},
        {"product_id": str(eggs.product_id), "name_en": eggs.name_en, "name_ur": "انڈے",
         "name_roman_ur": "anday", "aliases": "eggs, egg, anday"},
    ]
    return milk, eggs, rows


@pytest.fixture
def env(monkeypatch, tmp_path):
    milk, eggs, rows = make_catalog()
    db = FakeDB([milk, eggs])

    class Ctx:
        async def __aenter__(self):
            return db

        async def __aexit__(self, *a):
            return False

    async def load_index(_db, _store):
        return cn.CatalogIndex.from_catalog_dicts(rows)

    from app.services import llm_input_writer as w, order_builder_service as ob
    monkeypatch.setattr(tp, "AsyncSessionLocal", lambda: Ctx())
    monkeypatch.setattr(cn, "load_index_for_store", load_index)
    monkeypatch.setattr(w, "OUTPUT_DIR", tmp_path / "in")
    monkeypatch.setattr(ob, "ORDERS_DIR", tmp_path / "orders")

    calls = []

    async def llm(messages, schema):
        calls.append(schema["function"]["name"])
        enum = schema["function"]["parameters"]["properties"]["lines"]["items"]["properties"]["raw_mention"]["enum"]
        pid = {"haleeb milk": milk, "eggs": eggs, "انڈے": eggs}
        return {"lines": [{"raw_mention": m, "decision": "select", "product_id": str(pid[m].product_id),
                           "quantity": 2 if m == "haleeb milk" else 1} for m in enum if m in pid]}

    monkeypatch.setattr(lg, "_call_primary", llm)
    monkeypatch.setattr(lg, "_call_fallback", llm)
    return SimpleNamespace(store=FakeStore(), calls=calls, tmp=tmp_path, milk=milk, eggs=eggs)


def go(env, text, source="text", **kw):
    return asyncio.run(tp.run_turn(store=env.store, session_id="s1", store_id=STORE, text=text, source=source, **kw))


def test_typed_text_goes_through_full_pipeline(env):
    r = go(env, "do haleeb milk")
    assert r["status"] == "ready_to_confirm" and r["source"] == "text"
    assert r["order"]["lines"][0]["matched_name"] == "Haleeb Milk 1L" and r["order"]["lines"][0]["quantity"] == 2
    assert "Haleeb Milk 1L" in r["reply"]
    assert json.loads((env.tmp / "in" / "latest.json").read_text(encoding="utf-8"))["transcript"] == "do haleeb milk"
    assert json.loads((env.tmp / "orders" / "latest_order.json").read_text(encoding="utf-8"))["status"] == "ready_to_confirm"


def test_urdu_text_and_session_accumulates(env):
    go(env, "haleeb milk")
    r = go(env, "انڈے")                       # second typed turn, Urdu script
    assert sorted(l["matched_name"] for l in r["order"]["lines"]) == ["Eggs (Dozen)", "Haleeb Milk 1L"]
    llm_in = json.loads((env.tmp / "in" / "latest.json").read_text(encoding="utf-8"))
    assert llm_in["language_segments"][0]["lang"] == "Urdu"


def test_text_with_no_catalog_match_never_calls_the_llm(env):
    r = go(env, "pizza")
    assert r["status"] == "nothing_found" and env.calls == []
    assert "couldn't find" in r["reply"]


def test_voice_turn_uses_voice_segments(env):
    segs = [{"lang": "Urdu", "start_ms": 0, "end_ms": 900}]
    r = go(env, "haleeb milk", source="voice", language_segments=segs)
    assert r["source"] == "voice"
    assert json.loads((env.tmp / "in" / "latest.json").read_text(encoding="utf-8"))["language_segments"] == segs


# --------------------------------------------------------------------------- WebSocket protocol


@pytest.fixture
def ws_client(monkeypatch):
    from fastapi import FastAPI
    from app.routers import voice_ws as vw

    async def auth(token):
        if token != "good":
            from jose.exceptions import JOSEError
            raise JOSEError("bad")
        return str(uuid.uuid4())

    class S(FakeStore):
        pass

    turns = []

    async def fake_run_turn(**kw):
        turns.append(kw)
        return {"source": kw["source"], "transcript": kw["text"], "status": "ready_to_confirm",
                "reply": f"ok: {kw['text']}", "blocks_confirmation": False, "subtotal": 1.0, "order": None,
                "clarifications": [], "not_found": [], "reason": None, "file": "SECRET/PATH"}

    async def fake_transcribe(audio):
        if audio == b"bad":
            from app.core.exceptions import AsrUnavailable
            raise AsrUnavailable("down")
        text = "" if audio == b"silence" else "two milk"
        return SimpleNamespace(transcript=text, language_segments=[{"lang": "English"}],
                               is_final=True, to_dict=lambda: {"type": "transcript.final", "text": text})

    monkeypatch.setattr(vw, "_authenticate_ws", auth)
    monkeypatch.setattr(vw, "SessionStore", S)
    monkeypatch.setattr(vw.turn_pipeline_service, "run_turn", fake_run_turn)
    monkeypatch.setattr(vw, "transcribe", fake_transcribe)
    app = FastAPI()
    app.include_router(vw.router)
    client = TestClient(app)
    client.turns = turns
    return client


URL = f"/v1/voice/sessions/abc/stream?token=good&store_id={STORE}"


def test_ws_text_turn(ws_client):
    with ws_client.websocket_connect(URL) as ws:
        ws.send_text(json.dumps({"type": "text", "text": "  two   milk  ", "turn_id": "t1"}))
        msg = ws.receive_json()
        assert msg["type"] == "order.update" and msg["source"] == "text" and msg["reply"] == "ok: two milk"
        assert "file" not in msg                       # internal paths are never sent to the client
    assert ws_client.turns[0]["turn_id"] == "t1" and ws_client.turns[0]["text"] == "two milk"


def test_ws_voice_turn_sends_transcript_then_order_update(ws_client):
    with ws_client.websocket_connect(URL) as ws:
        ws.send_bytes(b"audio-bytes")
        ws.send_text(json.dumps({"type": "end_of_turn"}))
        assert ws.receive_json()["type"] == "transcript.final"
        upd = ws.receive_json()
        assert upd["type"] == "order.update" and upd["source"] == "voice"


def test_ws_silence_skips_the_order_pipeline(ws_client):
    with ws_client.websocket_connect(URL) as ws:
        ws.send_bytes(b"silence")
        ws.send_text(json.dumps({"type": "end_of_turn"}))
        assert ws.receive_json()["type"] == "transcript.final"
        ws.send_text(json.dumps({"type": "text", "text": "ping"}))      # still alive, next message is the typed turn
        assert ws.receive_json()["reply"] == "ok: ping"
    assert [t["source"] for t in ws_client.turns] == ["text"]


def test_ws_asr_failure_clears_the_buffer(ws_client):
    with ws_client.websocket_connect(URL) as ws:
        ws.send_bytes(b"bad")
        ws.send_text(json.dumps({"type": "end_of_turn"}))
        assert ws.receive_json()["error"] == "asr_unavailable"
        ws.send_bytes(b"audio")                       # next turn must not be glued to the failed one
        ws.send_text(json.dumps({"type": "end_of_turn"}))
        assert ws.receive_json()["type"] == "transcript.final"


@pytest.mark.parametrize("frame,error", [
    ({"type": "text", "text": "   "}, "empty_text"),
    ({"type": "text"}, "empty_text"),
    ({"type": "text", "text": 5}, "empty_text"),
    ({"type": "text", "text": "x" * 501}, "text_too_long"),
])
def test_ws_bad_text_frames(ws_client, frame, error):
    with ws_client.websocket_connect(URL) as ws:
        ws.send_text(json.dumps(frame))
        assert ws.receive_json()["error"] == error
    assert ws_client.turns == []


def test_ws_invalid_frames_do_not_kill_the_socket(ws_client):
    with ws_client.websocket_connect(URL) as ws:
        ws.send_text("not json")
        assert ws.receive_json()["error"] == "invalid_control_frame"
        ws.send_text("[1,2]")
        assert ws.receive_json()["error"] == "invalid_control_frame"
        ws.send_text(json.dumps({"type": "end_of_turn"}))
        assert ws.receive_json()["error"] == "no_audio_received"


def test_ws_pipeline_crash_is_reported_not_fatal(ws_client, monkeypatch):
    from app.routers import voice_ws as vw

    async def boom(**kw):
        raise RuntimeError("secret internal detail")
    monkeypatch.setattr(vw.turn_pipeline_service, "run_turn", boom)
    with ws_client.websocket_connect(URL) as ws:
        ws.send_text(json.dumps({"type": "text", "text": "milk"}))
        msg = ws.receive_json()
        assert msg == {"type": "error", "error": "order_pipeline_failed"}   # no internals leaked
        ws.send_text(json.dumps({"type": "text", "text": "milk"}))
        assert ws.receive_json()["error"] == "order_pipeline_failed"        # socket still alive


def test_ws_rejects_bad_token_and_bad_store(ws_client):
    with pytest.raises(WebSocketDisconnect):
        with ws_client.websocket_connect(f"/v1/voice/sessions/abc/stream?token=bad&store_id={STORE}"):
            pass
    with pytest.raises(WebSocketDisconnect):
        with ws_client.websocket_connect("/v1/voice/sessions/abc/stream?token=good&store_id=not-a-uuid"):
            pass


def _r(**kw):
    base = {"status": "ready_to_confirm", "reason": None, "subtotal": 0, "not_found": [], "clarifications": [],
            "changes": [], "not_in_order": [], "order": None}
    base.update(kw)
    return base


def test_reply_confirmed_cleared_and_empty():
    order = {"lines": [{"quantity": 2.0, "matched_name": "Milk 1L"}]}
    assert tp.build_reply(_r(status="confirmed", order=order, subtotal=600)) == \
        "Order confirmed: 2 x Milk 1L. Total: Rs 600. Thank you!"
    assert "cleared" in tp.build_reply(_r(status="cleared"))
    assert "empty" in tp.build_reply(_r(status="nothing_found", reason="empty_order"))


def test_reply_changes_and_not_in_order():
    order = {"lines": [{"quantity": 1.0, "matched_name": "Eggs (Dozen)"}]}
    out = tp.build_reply(_r(status="ready_to_confirm", order=order, subtotal=340, changes=["Removed Water Bottle 1L."]))
    assert out.startswith("Removed Water Bottle 1L. Your order: 1 x Eggs (Dozen).")
    out = tp.build_reply(_r(status="partially_resolved", order=order, subtotal=340, not_in_order=["Water Bottle 1L"]))
    assert "Water Bottle 1L isn't in your order." in out
    assert "now empty" in tp.build_reply(_r(status="order_empty", changes=["Removed Eggs (Dozen)."]))


def test_reply_confirm_blocked_by_question():
    out = tp.build_reply(_r(status="needs_clarification", reason="confirm_blocked_by_question",
                            clarifications=[{"question": "Which rice?"}]))
    assert out.startswith("Before I can confirm") and "Which rice?" in out