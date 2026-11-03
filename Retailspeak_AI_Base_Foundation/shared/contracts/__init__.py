"""
shared/contracts — the ONE copy of every Pydantic model used at any API
boundary in RetailSpeak AI (Execution Plan §1.7, §4.1).

Rule: nothing outside this package may redefine or fork these models.
Both nlu-half/* and fulfillment-half/* import from here directly:

    from shared.contracts.order import OrderJSON, ConfirmedOrder
    from shared.contracts.catalog import Product

Do not add fields "for later" — every open decision in
FOUNDATION_PLAN §6 has a placeholder shape already decided; extending
a model ahead of that table is exactly the "speculative building"
§1.6 forbids.
"""

from .order import OrderIntent, OrderLineItem, OrderJSON, ConfirmedOrder
from .catalog import Product
from .customer import Customer
from .store_users import StoreUserRole, StoreUser, OwnerApproval
from .khata import KhataEntryType, KhataEntry
from .inventory import InventoryRecord
from .purchase_order import (
    PurchaseOrderStatus,
    PurchaseOrderLine,
    PurchaseOrder,
)
from .rider import RiderStatus, Rider
from .fulfillment import FulfillmentStage, OrderStatusEvent
from .forecast import ForecastRecord

__all__ = [
    "OrderIntent",
    "OrderLineItem",
    "OrderJSON",
    "ConfirmedOrder",
    "Product",
    "Customer",
    "StoreUserRole",
    "StoreUser",
    "OwnerApproval",
    "KhataEntryType",
    "KhataEntry",
    "InventoryRecord",
    "PurchaseOrderStatus",
    "PurchaseOrderLine",
    "PurchaseOrder",
    "RiderStatus",
    "Rider",
    "FulfillmentStage",
    "OrderStatusEvent",
    "ForecastRecord",
]
