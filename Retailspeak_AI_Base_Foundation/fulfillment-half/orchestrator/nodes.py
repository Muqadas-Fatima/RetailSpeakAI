"""
TDD §5 (LangGraph State Machine Spec) — the actual transition logic.
Each method below is one "node" in TDD §5.2's table; `Orchestrator`
drives them in sequence, checkpointing (TDD §5.5) after every one, and
compensating in reverse (TDD §5.4) on failure. Two nodes
(`handle_warehouse_pick`, `decide_supplier_reorder`) are entered from an
external human-actor call rather than being driven straight through by
this class, matching TDD §4.6's "two exceptions carry a human actor's
ID" note -- the orchestrator resumes from a checkpoint when that call
arrives rather than blocking a thread waiting for it.

Idempotency keys (TDD §5.5): every stage call below is built through
`shared.idempotency.dedupe.idempotency_key(order_id, stage_name,
attempt_seq)`, with `attempt_seq` taken from `state.retry_attempt` --
the exact form TDD §5.5 specifies, so a resumed/retried pipeline reuses
the same key on the same attempt rather than minting a fresh one that
would defeat the whole point of the dedupe store.
"""

from __future__ import annotations

from shared.auth.roles import Role
from shared.contracts.fulfillment import FulfillmentStage
from shared.idempotency.dedupe import idempotency_key
from shared.realtime.eventbus import EventBus, default_event_bus, make_event

from graph import GraphInterrupt, PipelineGraph
from state import PipelineState
from wiring import StageBundle


class PipelineException(Exception):
    """Raised when a node hits a terminal/exception state (TDD §5.1:
    payment_failed, inventory_unavailable, cancelled, delivery_exception).
    Carries the already-updated PipelineState so the caller can inspect
    `current_stage`/`exception_reason` without re-deriving them."""

    def __init__(self, state: PipelineState) -> None:
        super().__init__(state.exception_reason or state.current_stage.value)
        self.state = state


class Orchestrator:
    def __init__(self, graph: PipelineGraph, stages: StageBundle, event_bus: EventBus | None = None) -> None:
        self._graph = graph
        self._stages = stages
        # Phase 4 (Execution Plan Prompt §4): every dashboard-relevant
        # transition also fans out on the event bus, alongside (never
        # instead of) the checkpoint write above it -- checkpointing is
        # the durable source of truth (TDD §5.5), the event bus is the
        # live-push convenience on top of it. Defaults to the process-wide
        # bus so api.py doesn't need to thread one through explicitly,
        # the same way `shared.idempotency.dedupe`'s default store works.
        self._events = event_bus or default_event_bus()

    def _notify(
        self,
        state: PipelineState,
        *,
        roles: tuple[Role, ...],
        actor: str = "system",
        detail: str | None = None,
        extra: dict | None = None,
        recipient_id: str | None = None,
    ) -> None:
        event = make_event(
            order_id=state.order_id,
            stage=state.current_stage,
            store_id=str(state.confirmed_order.store_id),
            roles=roles,
            actor=actor,
            detail=detail,
            extra=extra,
            recipient_id=recipient_id,
        )
        self._events.publish(event)

    # --- Entry point (TDD §4.5) ---

    def start(self, state: PipelineState) -> PipelineState:
        """Runs the fully-system-driven prefix of the graph: `placed` ->
        `inventory_reserved` -> `payment_settled` -> pick list generated,
        landing at `picking`. Stops there because the next transition
        (`picking` -> `ready`) requires a Warehouse Staff action (TDD
        §2.9, §4.6) this class cannot itself perform."""
        state = self._reserve_inventory(state)
        state = self._settle_payment(state)
        state = self._generate_pick_list(state)
        return state

    # --- placed -> inventory_reserved / inventory_unavailable (TDD §5.2 row 1) ---

    def _reserve_inventory(self, state: PipelineState) -> PipelineState:
        order = state.confirmed_order
        key = idempotency_key(state.order_id, "inventory", state.retry_attempt)
        result = self._stages.inventory.reserve(
            order_id=state.order_id,
            store_id=str(order.store_id),
            line_items=[(str(li.product_id), li.quantity) for li in order.line_items],
            idempotency_key=key,
        )
        if result["status"] != "reserved":
            # TDD §5.2 row 1: no side effect yet, so no compensation call
            # is needed here -- this just marks the terminal state.
            state.current_stage = FulfillmentStage.FAILED
            state.exception_reason = "inventory_unavailable"
            state.exception_detail = "; ".join(result["unavailable_lines"])
            self._graph.checkpoint(state, detail="inventory_unavailable")
            self._notify(state, roles=(Role.OWNER,), detail="inventory_unavailable")
            raise PipelineException(state)

        state.reservation_id = result["reservation_id"]
        state.current_stage = FulfillmentStage.INVENTORY_VERIFIED
        state.mark_committed("inventory", {"reservation_id": result["reservation_id"]})
        self._graph.checkpoint(state, detail="inventory reserved")
        return state

    # --- inventory_reserved -> payment_settled / payment_failed (TDD §5.2 row 2) ---

    def _settle_payment(self, state: PipelineState) -> PipelineState:
        order = state.confirmed_order
        key = idempotency_key(state.order_id, "payment_khata", state.retry_attempt)
        result = self._stages.payment_khata.settle(
            order_id=state.order_id,
            store_id=str(order.store_id),
            customer_id=str(order.customer_id) if order.customer_id else None,
            payment_method=order.payment_method or "jazzcash",
            stated_total_amount=order.total_amount,
            line_items=order.line_items,
            idempotency_key=key,
        )
        if result["outcome"] != "payment_settled":
            self._compensate(state)
            state.current_stage = FulfillmentStage.FAILED
            state.exception_reason = "payment_failed"
            state.exception_detail = result.get("reason")
            self._graph.checkpoint(state, detail=f"payment_failed: {result.get('reason')}")
            self._notify(state, roles=(Role.OWNER,), detail=f"payment_failed: {result.get('reason')}")
            raise PipelineException(state)

        state.transaction_ref = result.get("transaction_ref")
        state.khata_entry_id = result.get("khata_entry_id")
        state.current_stage = FulfillmentStage.PAYMENT_CONFIRMED
        state.mark_committed(
            "payment_khata",
            {
                "payment_method": order.payment_method,
                "transaction_ref": result.get("transaction_ref"),
                "customer_id": str(order.customer_id) if order.customer_id else None,
                "amount": order.total_amount,
            },
        )
        self._graph.checkpoint(state, detail="payment settled")
        return state

    # --- payment_settled -> picking (system generates the pick list) ---

    def _generate_pick_list(self, state: PipelineState) -> PipelineState:
        pick_list = self._stages.warehouse.generate_pick_list(
            order_id=state.order_id, reservation_id=state.reservation_id
        )
        state.pick_list_id = pick_list.pick_list_id
        state.current_stage = FulfillmentStage.PICKING
        self._graph.checkpoint(state, detail="pick list generated")
        self._notify(
            state, roles=(Role.WAREHOUSE_STAFF,), detail="pick list ready", extra={"pick_list_id": pick_list.pick_list_id}
        )
        return state

    # --- picking -> ready / delivery_exception (TDD §5.2 row 3, human actor) ---

    def handle_warehouse_pick(self, state: PipelineState, *, actor: str, discrepancy: bool, discrepancy_note: str | None) -> PipelineState:
        pick_list = self._stages.warehouse.mark_picked(
            order_id=state.order_id,
            reservation_id=state.reservation_id,
            actor=actor,
            discrepancy=discrepancy,
            discrepancy_note=discrepancy_note,
        )
        if pick_list.status == "exception":
            # TDD §5.2: keep payment, do not auto-rollback -- Owner
            # resolves manually. No compensation call fires here.
            state.current_stage = FulfillmentStage.FAILED
            state.exception_reason = "delivery_exception"
            state.exception_detail = discrepancy_note
            self._graph.checkpoint(state, actor=actor, detail="pick discrepancy flagged")
            self._notify(
                state, roles=(Role.OWNER, Role.WAREHOUSE_STAFF), actor=actor, detail="pick discrepancy flagged"
            )
            raise PipelineException(state)

        state.current_stage = FulfillmentStage.READY
        self._graph.checkpoint(state, actor=actor, detail="order ready")
        self._notify(state, roles=(Role.OWNER,), actor=actor, detail="order ready for delivery")
        return state

    # --- ready -> [supplier_reorder_pending]* (TDD §5.3 guard, parallel, non-blocking) ---

    def evaluate_supplier_reorder(
        self, state: PipelineState, *, product_id: str, available_qty: float, low_stock_threshold: float, reorder_qty: float
    ) -> PipelineState:
        """Called once per reserved line after inventory is finalized
        (TDD §5.3). Deliberately does NOT change `current_stage` or
        block anything downstream -- it only ever attaches a `po_id` to
        the state as a side note. Callers invoke this alongside (not
        before) `assign_rider`, never in between the customer's order
        and its own progress."""
        order = state.confirmed_order
        if not self._stages.supplier.evaluate_guard(
            available_qty=available_qty, low_stock_threshold=low_stock_threshold
        ):
            return state
        po = self._stages.supplier.draft_reorder(
            store_id=str(order.store_id),
            product_id=product_id,
            triggered_by_order_id=state.order_id,
            reorder_qty=reorder_qty,
        )
        state.po_id = str(po.po_id)
        self._graph.checkpoint(state, detail=f"supplier reorder drafted: {po.po_id}")
        self._notify(
            state, roles=(Role.OWNER,), detail="purchase order pending approval", extra={"po_id": str(po.po_id)}
        )
        return state

    # --- ready -> assigned_to_rider / stays ready (TDD §5.2 row 5) ---

    def assign_rider(self, state: PipelineState, *, delivery_address: str, delivery_lat: float | None, delivery_lng: float | None) -> PipelineState:
        order = state.confirmed_order
        result = self._stages.delivery.assign(
            order_id=state.order_id,
            store_id=str(order.store_id),
            delivery_address=delivery_address,
            delivery_lat=delivery_lat,
            delivery_lng=delivery_lng,
        )
        if result["held"]:
            # TDD §5.2: no compensation, stays `ready`, retried on a
            # timer, Owner alerted after StoreConfig.rider_no_match_alert_minutes.
            self._graph.checkpoint(state, detail="no rider available, held for retry")
            self._notify(state, roles=(Role.OWNER,), detail="no rider available, held for retry")
            return state

        state.rider_id = result["rider_id"]
        state.route_id = result["route_id"]
        state.current_stage = FulfillmentStage.ASSIGNED_TO_RIDER
        self._graph.checkpoint(state, detail=f"assigned to rider {result['rider_id']}")
        self._notify(
            state,
            roles=(Role.OWNER, Role.RIDER),
            detail="assigned to rider",
            extra={"rider_id": result["rider_id"], "route_id": result["route_id"], "delivery_address": delivery_address},
            recipient_id=result["rider_id"],
        )
        return state

    # --- assigned_to_rider -> out_for_delivery -> delivered (TDD §5.2 rows 6-7) ---

    def mark_out_for_delivery(self, state: PipelineState) -> PipelineState:
        state.current_stage = FulfillmentStage.OUT_FOR_DELIVERY
        self._stages.delivery.mark_status(rider_id=state.rider_id, order_id=state.order_id, status="out_for_delivery")
        self._graph.checkpoint(state, actor=f"rider:{state.rider_id}", detail="rider started route")
        self._notify(
            state,
            roles=(Role.OWNER, Role.RIDER),
            actor=f"rider:{state.rider_id}",
            detail="out for delivery",
            recipient_id=state.rider_id,
        )
        return state

    def mark_delivered(self, state: PipelineState) -> PipelineState:
        state.current_stage = FulfillmentStage.DELIVERED
        self._stages.delivery.mark_status(rider_id=state.rider_id, order_id=state.order_id, status="delivered")
        self._graph.checkpoint(state, actor=f"rider:{state.rider_id}", detail="delivered")
        self._notify(
            state,
            roles=(Role.OWNER, Role.RIDER),
            actor=f"rider:{state.rider_id}",
            detail="delivered",
            recipient_id=state.rider_id,
        )
        return state

    def mark_delivery_exception(self, state: PipelineState, *, detail: str) -> PipelineState:
        # TDD §5.2: inventory NOT auto-released; Owner decides
        # refund/khata-reversal vs. redelivery. No compensation fires.
        state.current_stage = FulfillmentStage.FAILED
        state.exception_reason = "delivery_exception"
        state.exception_detail = detail
        self._graph.checkpoint(state, detail=detail)
        self._notify(
            state, roles=(Role.OWNER, Role.RIDER), detail=detail, recipient_id=state.rider_id
        )
        return state

    # --- any active state -> cancelled (TDD §5.2 last row) ---

    def cancel(self, state: PipelineState, *, actor: str) -> PipelineState:
        if state.current_stage in (
            FulfillmentStage.OUT_FOR_DELIVERY,
            FulfillmentStage.DELIVERED,
            FulfillmentStage.CANCELLED,
        ):
            raise ValueError(
                f"order {state.order_id} cannot be cancelled from stage {state.current_stage} "
                "(TDD §5.2 guard: not yet out_for_delivery)"
            )
        self._compensate(state)
        state.current_stage = FulfillmentStage.CANCELLED
        self._graph.checkpoint(state, actor=actor, detail="cancelled")
        roles: tuple[Role, ...] = (Role.OWNER, Role.WAREHOUSE_STAFF)
        if state.rider_id:
            roles = roles + (Role.RIDER,)
        self._notify(state, roles=roles, actor=actor, detail="cancelled", recipient_id=state.rider_id)
        return state

    # --- TDD §5.4: rollback / compensation, walked in reverse commit order ---

    def _compensate(self, state: PipelineState) -> None:
        order = state.confirmed_order
        for committed in state.committed_stage_names_reversed():
            ref = committed.compensation_ref
            if committed.stage_name == "inventory":
                key = idempotency_key(state.order_id, "inventory", state.retry_attempt) + ":release"
                self._stages.inventory.release(
                    reservation_id=ref["reservation_id"], reason="compensating_rollback", idempotency_key=key
                )
            elif committed.stage_name == "payment_khata":
                self._stages.payment_khata.compensate(
                    payment_method=ref.get("payment_method") or "jazzcash",
                    transaction_ref=ref.get("transaction_ref"),
                    customer_id=ref.get("customer_id"),
                    order_id=state.order_id,
                    amount=ref.get("amount", order.total_amount),
                )
