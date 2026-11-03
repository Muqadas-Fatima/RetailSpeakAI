"""
Wires the orchestrator to each stage service's implementation.

Production shape (TDD §2.7, §8.1): the orchestrator calls each stage over
the internal mTLS network (`POST /internal/...`, TDD §4.6), not via a
Python import -- stage services are independently deployed containers
(Foundation Plan §2.3's per-service isolation table). Phase 3's tests and
this scaffold call the SAME stage-service classes (`InventoryStage`,
`PaymentKhataStage`, etc.) directly, in-process, which is a faithful
stand-in precisely because those classes are already the whole
implementation behind each stage's `api.py` HTTP layer -- swapping this
module for real HTTP clients later changes nothing about `nodes.py`'s
transition logic, since it only ever calls the methods this module
exposes (`reserve`, `settle`, `mark_picked`, ...), never the stage
classes' constructors directly.

Loaded via `importlib` with explicit aliases (not plain `import service`)
because every stage directory happens to contain a same-named
`service.py` (mirroring each stage's own api.py convention) -- without
aliasing, importing more than one in the same process clobbers
`sys.modules['service']`. Each stage's OWN process (its real api.py) never
hits this problem, since it only ever imports its own `service.py`; this
module exists specifically because the orchestrator is the one place in
the system that legitimately needs several stages' logic in one process
(Phase 3 test/dev scaffold only).
"""

from __future__ import annotations

import importlib.util
import os
import sys
from dataclasses import dataclass
from types import ModuleType

_HERE = os.path.dirname(os.path.abspath(__file__))
_FULFILLMENT_HALF = os.path.dirname(_HERE)
_REPO_ROOT = os.path.dirname(_FULFILLMENT_HALF)
_NLU_HALF = os.path.join(_REPO_ROOT, "nlu-half")
_RAG_SERVICE = os.path.join(_NLU_HALF, "rag-retrieval-service")
_VALIDATION_GATE = os.path.join(_NLU_HALF, "validation-gate")

_INVENTORY_DIR = os.path.join(_FULFILLMENT_HALF, "inventory-stage")
_PAYMENT_DIR = os.path.join(_FULFILLMENT_HALF, "payment-khata-stage")
_WAREHOUSE_DIR = os.path.join(_FULFILLMENT_HALF, "warehouse-stage")
_SUPPLIER_DIR = os.path.join(_FULFILLMENT_HALF, "supplier-stage")
_DELIVERY_DIR = os.path.join(_FULFILLMENT_HALF, "delivery-stage")
_NOTIFICATION_DIR = os.path.join(_FULFILLMENT_HALF, "notification-stage")

for _p in (
    _REPO_ROOT,
    _FULFILLMENT_HALF,
    _RAG_SERVICE,
    _VALIDATION_GATE,
    _INVENTORY_DIR,
    _PAYMENT_DIR,
    _WAREHOUSE_DIR,
    _SUPPLIER_DIR,
    _DELIVERY_DIR,
    _NOTIFICATION_DIR,
):
    if _p not in sys.path:
        sys.path.insert(0, _p)


def _load(alias: str, directory: str, filename: str = "service.py") -> ModuleType:
    spec = importlib.util.spec_from_file_location(alias, os.path.join(directory, filename))
    module = importlib.util.module_from_spec(spec)
    sys.modules[alias] = module
    spec.loader.exec_module(module)
    return module


@dataclass
class StageBundle:
    inventory: object
    payment_khata: object
    warehouse: object
    supplier: object
    delivery: object
    notification: object
    signer: object  # HMACOrderSigner, reused verbatim from validation-gate (Plan §4's own note)


def build_stage_bundle() -> StageBundle:
    from mock_catalog import DEFAULT_STORE_ID, MockCatalogStore
    from signer import HMACOrderSigner

    catalog = MockCatalogStore()

    inventory_mod = _load("_inventory_service", _INVENTORY_DIR)
    payment_mod = _load("_payment_service", _PAYMENT_DIR)
    warehouse_mod = _load("_warehouse_service", _WAREHOUSE_DIR)
    supplier_mod = _load("_supplier_service", _SUPPLIER_DIR)
    delivery_mod = _load("_delivery_service", _DELIVERY_DIR)
    notification_mod = _load("_notification_service", _NOTIFICATION_DIR)

    from shared.idempotency.dedupe import IdempotencyGuard, InMemoryDedupeStore
    from store import InMemoryInventoryStore  # inventory-stage/store.py, now on sys.path

    inventory = inventory_mod.InventoryStage(
        store=InMemoryInventoryStore(catalog._products), idempotency=IdempotencyGuard(InMemoryDedupeStore())
    )

    from gateway import gateway_for
    from khata_ledger import InMemoryKhataLedger

    # NOTE: both payment-khata-stage and delivery-stage ship their own
    # same-purpose fixture module (customer fixtures / rider fixtures
    # respectively, Plan §Phase 3 convention: one per stage). Loaded
    # explicitly by path (like the service.py modules above) rather than
    # a plain `from _customer_fixtures import ...` / `from
    # _rider_fixtures import ...`, purely for consistency with the
    # service-module loading pattern in this file -- these two names
    # don't actually collide with each other, unlike the service.py case.
    payment_fixtures = _load("_payment_dev_fixtures", _PAYMENT_DIR, filename="_customer_fixtures.py")

    payment_khata = payment_mod.PaymentKhataStage(
        khata_ledger=InMemoryKhataLedger(payment_fixtures.fixture_customers()),
        gateway_factory=gateway_for,
        idempotency=IdempotencyGuard(InMemoryDedupeStore()),
    )

    warehouse = warehouse_mod.WarehouseStage()
    supplier = supplier_mod.SupplierStage()

    from matcher import RiderMatcher

    delivery_fixtures = _load("_delivery_dev_fixtures", _DELIVERY_DIR, filename="_rider_fixtures.py")
    delivery = delivery_mod.DeliveryStage(RiderMatcher(delivery_fixtures.fixture_riders(DEFAULT_STORE_ID)))

    notification = notification_mod.NotificationStage()

    return StageBundle(
        inventory=inventory,
        payment_khata=payment_khata,
        warehouse=warehouse,
        supplier=supplier,
        delivery=delivery,
        notification=notification,
        signer=HMACOrderSigner(secret_key=b"test-secret"),
    )
