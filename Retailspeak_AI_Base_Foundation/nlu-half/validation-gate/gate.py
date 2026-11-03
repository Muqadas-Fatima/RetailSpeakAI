"""
TDD §2.6 — Pydantic Validation Gate: the final, non-negotiable check that
every product_id in the draft Order JSON exists in that store's live
catalog, quantities are positive, and the schema is well-formed. This is
the only point where LLM output is allowed to become a "real" order
artifact (TDD §2.6) -- and, per TDD line 589, it re-runs even on output
the LLM is structurally constrained to (candidate-set-only product_ids),
because the constraint only holds at the moment RAG retrieved candidates;
a product can be deactivated in the seconds between retrieval and
confirmation, and this gate is what catches that race.

Positive-quantity and the 500-unit sane ceiling are already enforced by
OrderLineItem's own Pydantic validators (shared/contracts/order.py) --
this gate does not re-implement those, it re-implements what Pydantic's
type system alone cannot: whether a product_id is real, active, and
unit-consistent for THIS store, right now. That requires a live catalog
read, which is why it's a separate gate module and not just "stricter
Pydantic."

Phase 2 (Execution Plan §4): the catalog read reuses
rag-retrieval-service's MockCatalogStore rather than forking a second
mock catalog (Plan §1.7's "one copy" spirit extended to test fixtures,
not just schemas) -- swap for a real live Postgres read without changing
ValidationGate's interface.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from uuid import UUID

from contracts.pipeline_io import RejectedLine
from shared.contracts.catalog import Product
from shared.contracts.order import OrderJSON


class CatalogLookup(ABC):
    """Live catalog read seam (TDD §2.6's "exists in that store's live
    catalog" check). Real implementation is a direct Postgres read --
    never cached, never embedding-derived (TDD §6.2's propagation split
    applies to name matching, not to this gate's identity/activity
    check)."""

    @abstractmethod
    def get(self, store_id: UUID, product_id: UUID) -> Product | None: ...


class MockCatalogLookup(CatalogLookup):
    """Phase 2 mock, backed by the same fixture catalog rag-retrieval-
    service already uses -- see module docstring: this is deliberately
    not a second mock catalog."""

    def __init__(self, catalog_store) -> None:  # noqa: ANN001 -- MockCatalogStore, imported by the caller
        self._catalog_store = catalog_store

    def get(self, store_id: UUID, product_id: UUID) -> Product | None:
        for product in self._catalog_store.active_products_for_store(store_id):
            if product.product_id == product_id:
                return product
        # Distinguish "doesn't exist" from "exists but inactive" by also
        # checking the store's full (not just active-filtered) product
        # list, so the gate can emit the more specific "product_inactive"
        # reason instead of a blanket "not found" for the deactivation-
        # race case TDD line 589 calls out explicitly.
        for product in getattr(self._catalog_store, "_products", []):
            if product.product_id == product_id and product.store_id == store_id:
                return product
        return None


class ValidationGate(ABC):
    @abstractmethod
    def validate(self, store_id: UUID, draft_order: OrderJSON) -> tuple[OrderJSON | None, list[RejectedLine]]:
        """Returns (validated_order, rejected_lines). validated_order is
        non-None iff rejected_lines is empty -- there is no partial-accept
        path (TDD §4.4: any problem line blocks confirmation for the
        whole turn, the customer resolves it and the order is re-run
        through grounding, not silently trimmed here)."""
        ...


class PydanticValidationGate(ValidationGate):
    def __init__(self, catalog: CatalogLookup) -> None:
        self._catalog = catalog

    def validate(self, store_id: UUID, draft_order: OrderJSON) -> tuple[OrderJSON | None, list[RejectedLine]]:
        rejected: list[RejectedLine] = []
        revalidated_lines = []

        for line in draft_order.line_items:
            if line.product_id is None:
                # Should be structurally impossible coming out of
                # grounder.py (every emitted line item is built from a
                # RAGCandidate, which always carries a product_id) -- but
                # this gate trusts nothing from upstream (Plan §1.3), so
                # it checks explicitly rather than assuming the invariant
                # held.
                rejected.append(
                    RejectedLine(
                        line_id=line.line_id,
                        raw_mention=line.raw_mention,
                        reason="product_id_not_found",
                        detail=f"{line.raw_mention} — not found",
                    )
                )
                continue

            product = self._catalog.get(store_id, line.product_id)

            if product is None:
                rejected.append(
                    RejectedLine(
                        line_id=line.line_id,
                        raw_mention=line.raw_mention,
                        reason="product_id_not_found",
                        detail=f"{line.raw_mention} — not found",
                    )
                )
                continue

            if not product.is_active:
                # TDD line 589's exact edge case: deactivated between
                # retrieval and confirmation.
                rejected.append(
                    RejectedLine(
                        line_id=line.line_id,
                        raw_mention=line.raw_mention,
                        reason="product_inactive",
                        detail=f"{product.name_en} — no longer available",
                    )
                )
                continue

            if line.unit != product.unit:
                rejected.append(
                    RejectedLine(
                        line_id=line.line_id,
                        raw_mention=line.raw_mention,
                        reason="unit_mismatch",
                        detail=f"{product.name_en} is sold by {product.unit}, not {line.unit}",
                    )
                )
                continue

            # Re-price from the live catalog at gate time -- never trust
            # the unit_price grounding attached (TDD §2.6 / Plan §1.3:
            # every stage boundary re-validates, price is exactly the
            # kind of value that can drift between retrieval and here).
            revalidated_lines.append(line.model_copy(update={"unit_price": product.price}))

        if rejected:
            return None, rejected

        validated_order = draft_order.model_copy(update={"line_items": revalidated_lines})
        return validated_order, []
