"""
TDD §8.1 — exactly four roles, each a distinct `role` JWT claim.
No generic "staff" role, no fallback auth mechanism (Plan §Phase 0).

This module is the shared vocabulary + a role-check decorator every
stage/endpoint uses. It does NOT implement Cognito token issuance
(that's an infra/provisioning concern) — it implements the shape every
downstream service checks a decoded JWT claim against, so "owner" vs
"warehouse_staff" vs "customer" vs "rider" is spelled the same way
everywhere instead of drifting into ad-hoc strings per service.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from functools import wraps
from typing import Callable, Iterable


class Role(str, Enum):
    OWNER = "owner"
    CUSTOMER = "customer"
    WAREHOUSE_STAFF = "warehouse_staff"
    RIDER = "rider"


class AuthorizationError(Exception):
    """Raised when a caller's role JWT doesn't satisfy an endpoint's required role.

    Per TDD §8.2, this must never be swallowed or downgraded to a warning —
    a role mismatch is a hard rejection, not a soft one, regardless of what
    the request body claims.
    """


@dataclass(frozen=True)
class AuthenticatedPrincipal:
    """Decoded-claim shape every stage/endpoint receives after JWT verification.

    store_id scoping (TDD §8.1): every role except (future, out of v1 scope)
    cross-store admin is scoped to exactly one store_id. Callers MUST check
    principal.store_id against the resource's store_id even when the role
    check passes — role correctness is necessary, not sufficient.
    """

    subject_id: str  # customer_id | user_id (owner/warehouse_staff) | rider_id
    role: Role
    store_id: str


def require_role(*allowed: Role) -> Callable:
    """
    Decorator for stage/endpoint handlers. Usage:

        @require_role(Role.OWNER)
        def decide_purchase_order(principal: AuthenticatedPrincipal, ...): ...

    Per TDD §4.6 / §8.2: two stage endpoints (warehouse/pick,
    supplier/reorder-decision) are invoked by human actors through the
    internal mTLS surface and must carry BOTH a valid service JWT AND the
    acting user's own role JWT. This decorator checks the human-role half;
    service-JWT verification is a separate, mandatory check at the
    transport layer, not a substitute for this.
    """

    allowed_set: Iterable[Role] = allowed

    def decorator(fn: Callable) -> Callable:
        @wraps(fn)
        def wrapper(principal: AuthenticatedPrincipal, *args, **kwargs):
            if principal.role not in allowed_set:
                raise AuthorizationError(
                    f"role {principal.role} not permitted; requires one of "
                    f"{[r.value for r in allowed_set]}"
                )
            return fn(principal, *args, **kwargs)

        return wrapper

    return decorator


# TDD §8.1 role -> permission summary, kept here as the single reference
# table so a new endpoint's author checks this before deciding what to
# gate rather than re-deriving it from the TDD each time.
ROLE_PERMISSIONS: dict[Role, dict[str, list[str]]] = {
    Role.OWNER: {
        "can": [
            "approve_reject_supplier_po",
            "manage_catalog",
            "manage_pricing",
            "manage_warehouse_staff_accounts",
            "view_all_dashboards",
            "issue_refunds_khata_adjustments",
        ],
        "cannot": ["pick_orders", "deliver_orders"],
    },
    Role.CUSTOMER: {
        "can": [
            "place_modify_confirm_cancel_own_orders",
            "view_own_order_history",
            "view_own_khata_balance",
        ],
        "cannot": [
            "view_other_customers_data",
            "view_catalog_cost_prices",
            "access_owner_or_warehouse_tooling",
        ],
    },
    Role.WAREHOUSE_STAFF: {
        "can": ["view_act_on_assigned_pick_lists", "mark_lines_picked", "flag_pick_discrepancies"],
        "cannot": ["approve_po", "adjust_prices", "issue_refunds", "view_khata_or_financial_data"],
    },
    Role.RIDER: {
        "can": ["view_assigned_deliveries", "update_delivery_gps_status", "mark_delivered"],
        "cannot": ["view_catalog", "view_pricing", "view_other_riders_deliveries", "view_khata_data"],
    },
}
