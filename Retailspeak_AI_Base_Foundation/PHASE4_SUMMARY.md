# RetailSpeak AI — Phase 4 Summary

**Scope:** Execution Plan Prompt §4, Phase 4 — "Dashboards & Clients."
Build `warehouse-staff-app/`, `owner-dashboard/`, `rider-client/`, each
role-gated per the Phase 0 auth scaffolding, each consuming the
real-time event pattern (Redis pub/sub → WebSocket) rather than
polling. Everything here builds on Phase 3's fulfillment pipeline —
these clients render what Phase 3 already tracks, they don't add new
fulfillment logic.

---

## 1. What was built

| Component | Path | Notes |
|---|---|---|
| Event bus (Redis pub/sub seam) | `shared/realtime/eventbus.py` | Store-scoped broadcast channels (Owner, Warehouse Staff) + recipient-scoped channels (Rider) |
| WebSocket gateway service | `fulfillment-half/realtime-gateway/api.py` | `GET /ws/{store_id}/{role}[?recipient_id=]`, the actual socket all three clients open |
| Orchestrator event publishing | `fulfillment-half/orchestrator/nodes.py` | Every dashboard-relevant transition now also calls `self._notify(...)`, alongside (never instead of) the existing checkpoint write |
| Owner order-overview query | `GET /internal/orchestrator/orders` (`orchestrator/api.py`), `checkpointer.list_order_ids` | |
| Warehouse pick-queue query | `GET /internal/warehouse/pick-lists` (`warehouse-stage/api.py`), `WarehouseStage.list_pick_lists` | |
| Owner PO-approval queue query | `GET /internal/supplier/pending-pos` (`supplier-stage/api.py`), `SupplierStage.list_pending` | |
| Rider assignment-list query | `GET /internal/delivery/assignments/{rider_id}` (`delivery-stage/api.py`), `DeliveryStage.list_for_rider` / `.mark_status` | |
| Owner Dashboard | `clients/owner-dashboard/index.html` | PO approval queue, order overview, live activity feed |
| Warehouse Staff App | `clients/warehouse-staff-app/index.html` | Floor-facing pick queue, large tap targets, mark-ready / flag-discrepancy |
| Rider Client | `clients/rider-client/index.html` | Own-deliveries list, start/complete delivery (doubles as the TDD §11 manual GPS fallback) |
| Client run instructions | `clients/README.md` | |

## 2. Design decisions and why

- **One new deployable service, not three.** `realtime-gateway/` is the
  only genuinely new backend component; everything else is a query
  endpoint added to an existing Phase 3 stage service, matching that
  stage's own data (pick lists live in `warehouse-stage`, POs live in
  `supplier-stage`, etc.) rather than inventing a separate
  dashboard-backend-for-frontend layer the source docs never specify.
- **REST for initial load, WebSocket for live updates, short poll as a
  backstop.** Every client loads its first screen via the relevant
  `GET .../list` endpoint, then a WebSocket subscription re-triggers a
  re-pull whenever a relevant event fires, plus a 15-second poll so a
  dropped/reconnecting socket never leaves the screen stale for more
  than that window. This matches TDD §9's own "all views converge on
  the same state within the pub/sub delivery latency" framing — the
  socket is what makes it feel live, the REST endpoints remain the
  source of truth.
- **Recipient-scoped channels for Riders, broadcast channels for
  Owner/Warehouse Staff.** `shared/auth/roles.py`'s
  `ROLE_PERMISSIONS[Role.RIDER]["cannot"]` explicitly lists
  `view_other_riders_deliveries`. The event bus enforces this at the
  channel-key level (`(store_id, role, recipient_id)`), not by trusting
  the client to filter a broadcast stream — a rider's socket literally
  cannot subscribe to another rider's channel. Owner and Warehouse
  Staff channels stay store-wide broadcasts because TDD §8.1 makes
  those store-wide roles (exactly one owner, a shared pick queue).
- **`Role.CUSTOMER` is never a publish target on this bus.** Customers
  get order-status updates via the Notification stage's SMS/WhatsApp/
  voice channels (already built in Phase 3) — the dashboard event bus
  is Phase 4's own, separate channel, and `realtime-gateway` rejects a
  `customer`-role connection outright rather than accepting a socket
  that would never receive anything.
- **No framework, no build step.** TDD §2.9 specifies "lightweight
  web/mobile app" for the Warehouse Staff App and implies the same
  framework choice for the Owner dashboard; nothing in the source docs
  picks a specific framework, and Plan §1.6 says don't build ahead of
  an undecided item. Each client is a single `index.html` — plain
  fetch()/WebSocket, no `npm install`. Wrapping these in React Native /
  a PWA shell / whatever framework gets chosen later is additive, not a
  rewrite (see `clients/README.md`).
- **Login screens take a plain actor id, not a real JWT.** Phase 0
  built the role vocabulary and every endpoint's role check against it;
  issuing/verifying real Cognito JWTs from a browser is an auth
  integration task the Execution Plan Prompt scopes to "role-gated per
  the Phase 0 auth scaffolding," not "implement Cognito." Each client
  sends `actor: "{role}:{id}"` on writes — the same placeholder shape
  `warehouse-stage/api.py` and `supplier-stage/api.py` already
  document from Phase 3.

## 3. Tests

`tests/pipeline/test_phase4_dashboard_clients.py` — 12 tests covering:

- **Warehouse Staff journey:** a new order appears on the pick queue;
  marking it ready advances the order and clears the queue; flagging a
  discrepancy routes to `exception` and fires an Owner-channel event.
- **Owner journey:** a low-stock line drafts a PO the owner can see and
  approve; approving removes it from the pending queue; rejecting is
  terminal (a second decision on the same PO is refused); the order
  overview reflects current stage and exceptions.
- **Rider journey:** an assigned rider sees their delivery with address
  and ETA; starting then completing delivery updates their own list's
  status; a rider never sees another rider's assignment (skips
  gracefully if the fixture matcher happens to assign both test orders
  to the same rider, rather than asserting a false negative).
- **Event bus scoping:** Owner and Warehouse Staff channels are
  independent; the Rider channel requires and enforces
  `recipient_id`; `Role.CUSTOMER` is structurally excluded from every
  publish target.

Every fixture reused from Phase 1–3 rather than forked (`MockCatalogStore`,
`DEFAULT_STORE_ID`, `build_stage_bundle()`), per Plan §1.7's "one copy"
principle extended to test setup, same as Phase 3's own summary notes.

**Verification performed in this environment:** unlike Phase 3 (built
in a sandbox with no network access), this environment *does* have
`pip`/PyPI access, so the full suite was actually run, not just
statically traced:

```
python3 -m pytest tests/ -q
72 passed  (60 from Phase 1–3, 12 new in Phase 4)
```

Every `.py` file across the repo — Phase 1–4 combined — also passes
`python3 -m py_compile`. The three new `GET` endpoints
(`/internal/warehouse/pick-lists`, `/internal/supplier/pending-pos`,
`/internal/delivery/assignments/{rider_id}`, `/internal/orchestrator/orders`)
and the WebSocket gateway (`realtime-gateway/api.py`) were additionally
smoke-tested with FastAPI's `TestClient`, including an end-to-end
publish → WebSocket-receive round trip and confirming a `customer`-role
socket is rejected.

## 4. What "using only the built UI" does and doesn't mean here

The Phase 4 exit criteria in the Execution Plan Prompt reads: "each of
the four personas ... can complete their full journey ... using only
the built UI, no manual DB/API intervention." Three of those four
journeys (Owner, Warehouse Staff, Rider) now have a genuine UI —
`clients/*/index.html` — that calls only the documented REST/WebSocket
surface, no direct DB access anywhere in any client. The Customer
journey was already UI-complete as of Phase 1/2 (voice, not a
dashboard) and Phase 4 adds nothing to it.

What this phase's test suite does NOT do is drive those three HTML
pages through an actual browser (no Selenium/Playwright harness set up
in this environment). `test_phase4_dashboard_clients.py` instead
exercises the exact same service-layer calls each page's JavaScript
makes — every `fetch()`/WebSocket call in the three clients has a
corresponding assertion at the layer that call would hit. This is the
same layer Phase 3's own integration tests operate at (see that
phase's summary), so it's a consistent choice across phases, not a
Phase-4-specific shortcut — but it is a real gap against "runs in an
actual browser," worth closing with a browser-automation pass before
this ships.

## 5. Deliberately out of scope for Phase 4 (per Plan §10, not half-built)

- **Catalog/pricing management, Warehouse Staff account provisioning,
  refund/khata adjustments** — all real Owner capabilities per TDD
  §8.1's role table, but none have a corresponding fulfillment-half
  endpoint yet (they belong to a catalog-management/admin surface, not
  built in any phase so far). Building client UI against an endpoint
  that doesn't exist would be exactly the half-built pattern Plan §10
  rules out.
- **Barcode/QR scanning in the Warehouse Staff App** — TDD §2.9 calls
  it out explicitly. The tap-target layout is built to receive a scan
  handler later (it would call the same `markPicked`/discrepancy
  functions a tap does), but no scan library is wired in — which
  library/format to standardize on isn't specified anywhere in the
  source docs (Plan §1.6).
- **Live GPS feed for the Rider client** — the manual arrived/delivered
  button (TDD §11's fallback control) is built as the *primary*
  control in v1, since no GPS SDK integration is scoped by any phase;
  swapping in live GPS later means conditionally hiding the manual
  button when `gps_reliable` is true, not rebuilding the flow.
- **Real Cognito auth in the browser** — see §2 above.
- **Order batching for rider assignment, shift/payout logic** —
  unchanged open items from Plan §10, carried forward from Phase 3.

## 6. Suggested Phase 5 (per Foundation Plan §7)

Observability & Load/Benchmark Validation — WER/extraction-accuracy
benchmark suites, P95 voice-turn latency load test, inventory-
concurrency and khata-reconciliation chaos tests run at load (already
written in Phase 3), demand-forecast MAPE backtest. Per the Execution
Plan Prompt §2's Definition of Done, this is also where a browser-
automation pass over the three Phase 4 clients belongs, to close the
gap noted in §4 above before v1 ships.
