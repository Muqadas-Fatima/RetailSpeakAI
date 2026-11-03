"""
TDD §2.8 / §11 — `PaymentGateway` interface. Provider-specific adapters
(JazzCash, EasyPaisa) implement a common `charge()`/`refund()` contract
so a provider API change is isolated to one adapter class, not the
pipeline (TDD §11's stated fallback for "Payment API changes").

Phase 3 mocks hit no real network (Plan §Phase 0's dev/staging PAYMENT_ENV
guard: sandbox-only credentials, never live in non-prod) -- these two
classes stand in for that sandbox call. Deterministic-but-configurable
failure injection (`force_decline`) exists specifically so
tests/rollback/test_stage_rollback_fault_injection.py can exercise the
"Provider decline/timeout -> no khata entry created, inventory/release
called" compensation path from TDD §4.6 without a real provider.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from uuid import uuid4


@dataclass
class ChargeResult:
    transaction_ref: str | None
    status: str  # "success" | "declined" | "timeout"


class PaymentGateway(ABC):
    @abstractmethod
    def charge(self, *, order_id: str, amount: float) -> ChargeResult: ...

    @abstractmethod
    def refund(self, *, transaction_ref: str, amount: float) -> ChargeResult: ...


class _MockGatewayBase(PaymentGateway):
    """Shared mock behavior for both providers -- real adapters would NOT
    share an implementation (each hits a different REST API), but the
    mocks legitimately can, since both are standing in for "some sandbox
    endpoint that usually succeeds.\""""

    def __init__(self, force_decline: bool = False, force_timeout: bool = False) -> None:
        self._force_decline = force_decline
        self._force_timeout = force_timeout

    def charge(self, *, order_id: str, amount: float) -> ChargeResult:
        if self._force_timeout:
            return ChargeResult(transaction_ref=None, status="timeout")
        if self._force_decline:
            return ChargeResult(transaction_ref=None, status="declined")
        return ChargeResult(transaction_ref=f"txn_{uuid4().hex[:12]}", status="success")

    def refund(self, *, transaction_ref: str, amount: float) -> ChargeResult:
        return ChargeResult(transaction_ref=transaction_ref, status="success")


class MockJazzCashGateway(_MockGatewayBase):
    pass


class MockEasyPaisaGateway(_MockGatewayBase):
    pass


def gateway_for(payment_method: str, **kwargs) -> PaymentGateway:
    if payment_method == "jazzcash":
        return MockJazzCashGateway(**kwargs)
    if payment_method == "easypaisa":
        return MockEasyPaisaGateway(**kwargs)
    raise ValueError(f"unsupported payment_method: {payment_method}")
