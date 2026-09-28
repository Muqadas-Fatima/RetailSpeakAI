"use client";
/**
 * Mock dashboard data source.
 *
 * Every value is read from JSON under `src/data/owner/`, never written inline.
 * Replace these three functions with real API calls and the screens stay
 * unchanged (`GET /owner/dashboard`, `GET /owner/sales`, `GET /owner/forecast`).
 */
import dashboardData from "@/data/owner/dashboard.json";
import forecastData from "@/data/owner/forecast.json";
import notificationsData from "@/data/owner/notifications.json";
import salesData from "@/data/owner/sales.json";
import type {
  Forecast,
  ForecastHorizon,
  OwnerDashboard,
  OwnerNotification,
  SalesMetric,
  SalesRange,
  SalesSeries,
} from "./types";

export const PLACEHOLDER_DASHBOARD = dashboardData as unknown as OwnerDashboard;

export const PLACEHOLDER_NOTIFICATIONS = notificationsData as OwnerNotification[];

type SalesDataset = Record<SalesRange, Record<SalesMetric, Omit<SalesSeries, "range" | "metric">>>;

export function placeholderSales(range: SalesRange, metric: SalesMetric): SalesSeries {
  const dataset = salesData as unknown as SalesDataset;
  const series = dataset[range]?.[metric];
  if (!series) return { range, metric, total: "—", unit: "", points: [] };
  return { range, metric, ...series };
}

type ForecastDataset = Record<ForecastHorizon, Omit<Forecast, "horizon">>;

export function placeholderForecast(horizon: ForecastHorizon): Forecast {
  const dataset = forecastData as unknown as ForecastDataset;
  const forecast = dataset[horizon];
  if (!forecast) {
    return { horizon, needingAttention: 0, highDemand: 0, potentialStockouts: 0, rows: [] };
  }
  return { horizon, ...forecast };
}
