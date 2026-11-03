# RetailSpeak AI — Phase 3 Summary

**Scope:** Foundation Plan §7, Phase 3 — "LangGraph fulfillment pipeline, stage by stage." Everything here builds on the signed `ConfirmedOrder` Phase 2 produces (`nlu-half/validation-gate/`) and carries it through to `delivered`.

---

## 1. What was built

| Component | Path | TDD ref |
|---|---|---|
| Idempotency-key dedupe guard | `shared/idempotency/dedupe.py` | §5.5 |
| Fulfillment-half internal contracts | `fulfillment-half/contracts/pipeline_io.py` | §4.6 |
| Inventory stage (row-locked reserve/release) | `fulfillment-half/inventory-stage/` | §2.8, §7.2 |
| Payment/Khata stage (gateway + ledger, routing guard, server-side re-pricing) | `fulfillment-half/payment-khata-stage/` | §2.8, §5.3, §8.2 |
| Warehouse stage (pick list + human-actor pick confirmation) | `fulfillment-half/warehouse-stage/` | §2.8, §2.9, §4.6 |
| Supplier stage (Auto-PO draft + owner-approval interrupt) | `fulfillment-half/supplier-stage/` | §2.8, §5.3 |
| Delivery stage (rider matcher, hold-and-retry) | `fulfillment-half/delivery-stage/` | §2.8, §5.2 |
| Notification stage (non-blocking, fire-and-forget) | `fulfillment-half/notification-stage/` | §2.8, §4.6 |
| Orchestrator: state, checkpointer, graph seam, node functions, `/v1/fulfillment/orders` entry point | `fulfillment-half/orchestrator/` | §2.7, §5 |

`orchestrator/graph.py`'s `PipelineGraph`/`GraphInterrupt` stand in for a real `langgraph.StateGraph` + `interrupt()` (Foundation Plan §3 stack item #7) — node functions in `nodes.py` are written against this seam's interface, not against the `langgraph` package directly, so swapping in the real library later is a rewrite of `graph.py` alone.

## 2. Tests (Foundation Plan §9 — written alongside their stage, not batched)

| Test | Path | Requirement |
|---|---|---|
| Concurrent-reservation chaos test | `tests/chaos/test_concurrent_reservation.py` | Plan §9 / TDD §12: never oversells, no reservation silently lost, per-row (not table-level) lock granularity |
| Khata reconciliation property test | `tests/property/test_khata_reconciliation.py` | TDD §12: `running_balance_after` sums exactly under concurrency; credit-limit check is atomic with the balance mutation |
| Pipeline rollback fault-injection tests | `tests/rollback/test_stage_rollback_fault_injection.py` | TDD §12: forced post-commit stage failure → exactly one compensating call; idempotency-key dedupe verified via forced retry |
| Full pipeline integration test | `tests/pipeline/test_phase3_fulfillment_pipeline.py` | Happy path to `delivered`; khata routing (within-limit and over-limit); supplier-reorder parallel branch (non-blocking); no-rider hold; pick discrepancy (no auto-rollback); cancellation compensation; cancellation-after-`out_for_delivery` guard |

Every fixture reused from Phase 1/2 rather than forked (Plan §1.7's "one copy" principle extended to test data): `mock_catalog.py`'s already-low-stock "Sunflower Oil 1L" row drives the supplier-reorder tests; `HMACOrderSigner` is imported verbatim from `validation-gate/signer.py` for the entry-point's signature re-verification.

## 3. Verification performed in this environment

This sandbox has no network access, so `pydantic`/`fastapi`/`langgraph` couldn't be installed and the test suite couldn't actually be executed here (the same constraint applies to Phases 0–2's code). What was done instead:

- Every file passed `python3 -m py_compile` (syntax-valid).
- Every cross-module call was manually traced — stage service method signatures against orchestrator node calls, contract model fields against the dicts each service returns, fixture module names against their imports.
- Two real bugs were found and fixed this way: `orchestrator/wiring.py` and `tests/pipeline/test_phase3_fulfillment_pipeline.py` referenced a `_dev_fixtures.py` filename that didn't match the actual `_customer_fixtures.py` / `_rider_fixtures.py` files on disk.

**Before this ships:** run the actual suite (`pip install -e .` with real dependencies, then `pytest tests/`) in a networked dev environment — static tracing catches wiring bugs, not runtime behavior.

## 4. Deliberately out of scope for Phase 3 (per Foundation Plan §10, not half-built)

- **Order batching** for the Delivery stage (TDD §2.8 mentions it; nothing in §5's state machine requires it for v1 correctness) — noted as a gap in `delivery-stage/matcher.py`, not implemented.
- **Real LangGraph / Postgres checkpointer / PostGIS / JazzCash-EasyPaisa sandbox integration** — all have explicit seams (`graph.py`, `checkpointer.py`, `matcher.py`, `gateway.py`) built specifically so swapping the mock for the real backend doesn't touch caller code.
- **Two-way supplier PO acknowledgment** — `supplier-stage/service.py` implements the one-way-document model per the Plan §10 placeholder; `PurchaseOrderStatus.CONFIRMED` exists in the enum but nothing sets it yet.
- **Order-batching for rider assignment, shift/payout logic** — unchanged open items from Plan §10.

## 5. Suggested Phase 4 (per Foundation Plan §7)

Dashboards/clients — `warehouse-staff-app/`, `owner-dashboard/`, `rider-client/` — each consuming this phase's endpoints, role-gated per `shared/auth/roles.py`, driven by the real-time event pattern (Redis pub/sub → WebSocket) the Notification stage's mock stands in for.
