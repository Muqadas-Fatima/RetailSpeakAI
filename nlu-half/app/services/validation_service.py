"""
Pydantic Validation Gate — TDD §2.6. "Final, non-negotiable check that
every product_id in the draft Order JSON exists in that store's live
catalog, quantities are positive and within per-product max-order limits,
and the schema is well-formed. This is the only point where LLM output is
allowed to become a 'real' order artifact."

This runs server-side only (never client, never inside the LLM
container), and is deliberately the single choke point every draft order
must pass through — including in the adversarial hallucination test suite
required alongside this file per Foundation Plan §9.
"""
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.db_models import Product
from app.schemas.order import DraftOrderJSON, OrderJSON, ValidationError, ValidationResult


async def validate_draft_order(db: AsyncSession, draft: DraftOrderJSON) -> ValidationResult:
    errors: list[ValidationError] = []

    if not draft.lines:
        # An order with zero resolved lines can still be a valid *intermediate*
        # state (e.g. everything is pending clarification), but it can never
        # pass the gate as a confirmable order.
        errors.append(
            ValidationError(reason="Order has no resolved line items", code="empty_order")
        )
        return ValidationResult(valid=False, order=None, errors=errors)

    product_ids = [line.product_id for line in draft.lines]
    stmt = select(Product).where(
        Product.product_id.in_(product_ids),
        Product.store_id == draft.store_id,
        Product.is_active.is_(True),
    )
    result = await db.execute(stmt)
    live_products: dict[uuid.UUID, Product] = {p.product_id: p for p in result.scalars().all()}

    for line in draft.lines:
        product = live_products.get(line.product_id)

        if product is None:
            errors.append(
                ValidationError(
                    line_id=line.line_id,
                    raw_mention=line.raw_mention,
                    reason=f"product_id {line.product_id} is not an active product in store {draft.store_id}",
                    code="product_not_in_catalog",
                )
            )
            continue

        if line.quantity <= 0:
            errors.append(
                ValidationError(
                    line_id=line.line_id,
                    raw_mention=line.raw_mention,
                    reason="quantity must be greater than zero",
                    code="quantity_not_positive",
                )
            )
            continue

        if product.max_order_qty is not None and line.quantity > float(product.max_order_qty):
            errors.append(
                ValidationError(
                    line_id=line.line_id,
                    raw_mention=line.raw_mention,
                    reason=f"quantity {line.quantity} exceeds max_order_qty {product.max_order_qty}",
                    code="quantity_exceeds_max",
                )
            )
            continue

        # Re-stamp price/name/unit from the live catalog row rather than
        # trusting whatever the LLM/RAG snapshot carried — closes the gap
        # between "was true when RAG ran" and "true right now."
        line.matched_name = product.name_en
        line.unit = product.unit
        line.unit_price = float(product.price)

    if errors:
        return ValidationResult(valid=False, order=None, errors=errors)

    validated_order = OrderJSON(**draft.model_dump(), validated=True)
    return ValidationResult(valid=True, order=validated_order, errors=[])
