"use client";
/**
 * Owner Portal DTOs. Every shape mirrors a future backend API response so
 * screens can switch from the placeholder repository to real endpoints without
 * any UI change.
 */

export type OwnerProfile = {
  /** Display name coming from the authenticated owner record. */
  name: string;
  email: string;
  role: string;
  /** Optional avatar URL; components fall back to initials. */
  avatarUrl?: string;
};

export type NotificationCategory = "low-stock" | "purchase-order" | "supplier" | "ai";

export type OwnerNotification = {
  id: string;
  category: NotificationCategory;
  title: string;
  message: string;
  /** ISO timestamp — formatted in the UI, never precomputed by the backend. */
  createdAt: string;
  read: boolean;
  /** Destination route for this notification. */
  href: string;
};

export type Trend = "up" | "down" | "flat";

export type Kpi = {
  id: string;
  label: string;
  /** Preformatted display value from the API (currency/locale is backend owned). */
  value: string;
  subtitle: string;
  trend?: Trend;
  /** Lucide icon key resolved by the UI icon registry. */
  icon: string;
  href: string;
  tone?: "default" | "warning" | "critical";
  /** Permission module that gates this KPI. */
  moduleId?: string;
};

export type QuickAction = {
  id: string;
  label: string;
  icon: string;
  href: string;
  primary?: boolean;
  /** Permission module that gates this action. */
  moduleId?: string;
  /** Action required on the module (defaults to "view"). */
  requiredAction?: string;
};

export type SalesRange = "daily" | "weekly" | "monthly";

export type SalesMetric = "revenue" | "orders" | "average-order";

export type SalesPoint = { label: string; value: number };

export type SalesSeries = {
  range: SalesRange;
  metric: SalesMetric;
  /** Preformatted total for the selected range/metric. */
  total: string;
  /** Currency/unit suffix used in tooltips. */
  unit: string;
  points: SalesPoint[];
};

export type BestSeller = {
  id: string;
  rank: number;
  product: string;
  unitsSold: number;
  revenue: string;
};

export type SlowMover = {
  id: string;
  product: string;
  unitsSold: number;
  currentStock: number;
  lastSold: string;
};

export type StockStatus = "critical" | "low";

export type LowStockItem = {
  id: string;
  product: string;
  currentStock: number;
  threshold: number;
  suggestedReorder: number;
  preferredSupplier: string;
  status: StockStatus;
  href: string;
};

export type RecentOrder = {
  id: string;
  reference: string;
  customer: string;
  items: number;
  total: string;
  payment: string;
  status: string;
  placedAt: string;
  href: string;
};

export type VoiceAnalytics = {
  totalVoiceOrders: string;
  voiceShare: number;
  textShare: number;
  languages: { label: string; share: number }[];
  peakHours: { label: string; share: number }[];
};

export type ForecastHorizon = "tomorrow" | "3-days" | "7-days" | "30-days";

export type ForecastRow = {
  id: string;
  product: string;
  currentStock: number;
  predictedDemand: number;
  difference: number;
  daysUntilStockout: number | null;
  recommendation: string;
};

export type Forecast = {
  horizon: ForecastHorizon;
  needingAttention: number;
  highDemand: number;
  potentialStockouts: number;
  rows: ForecastRow[];
};

export type AlertSeverity = "critical" | "warning" | "info";

export type AiAlert = {
  id: string;
  severity: AlertSeverity;
  message: string;
  currentStock: number;
  predictedDemand: number;
  suggestedReorder: number;
};

export type PurchaseOrderStage =
  "draft" | "pending-approval" | "sent" | "partially-received" | "received";

export type PurchaseOrderSummary = {
  id: string;
  reference: string;
  supplier: string;
  itemCount: number;
  total: string;
  stage: PurchaseOrderStage;
  expectedAt: string;
  href: string;
};

export type SupplierLedgerEntry = {
  id: string;
  supplier: string;
  /** Preformatted outstanding balance from the API. */
  balance: string;
  lastPayment: string;
  dueLabel: string;
  status: "overdue" | "due-soon" | "settled";
  href: string;
};

export type ReceivingTask = {
  id: string;
  reference: string;
  supplier: string;
  expectedItems: number;
  receivedItems: number;
  status: "awaiting" | "partial" | "complete";
  href: string;
};

export type OwnerDashboard = {
  kpis: Kpi[];
  quickActions: QuickAction[];
  bestSellers: BestSeller[];
  slowMovers: SlowMover[];
  lowStock: LowStockItem[];
  recentOrders: RecentOrder[];
  voice: VoiceAnalytics;
  alerts: AiAlert[];
  purchaseOrders: PurchaseOrderSummary[];
  supplierLedger: SupplierLedgerEntry[];
  receiving: ReceivingTask[];
};

/** Generic async resource shape shared by every owner data hook. */
export type Resource<T> = {
  data: T | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
};
