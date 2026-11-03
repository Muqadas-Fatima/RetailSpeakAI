"""
TDD §3.10 — Forecast Record.

model_used distinguishes "ml_model_v{n}" from "seasonal_heuristic" —
Plan §Phase 5 requires falling back to the simpler heuristic until
>=60 days of sales history exists to backtest MAPE against (<25%
threshold). Don't wire the ML path before that data exists.
"""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class ForecastRecord(BaseModel):
    forecast_id: UUID
    store_id: UUID
    product_id: UUID
    forecast_date: datetime  # date being predicted for
    predicted_demand_qty: float
    current_stock_qty: float
    shortage_flag: bool  # predicted_demand_qty > current_stock_qty
    recommended_restock_qty: float
    model_used: str  # "ml_model_v{n}" | "seasonal_heuristic"
    mape_at_generation: float | None = None  # backtested MAPE if available
    generated_at: datetime
