"use client";
import { Link } from "@/lib/router-compat";
import { AlertCircle, AlertTriangle, ArrowDownRight, ArrowRight, ArrowUpRight, Info, Minus } from "lucide-react";
import { useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { OwnerIcon } from "@/components/owner/icons";
import {
  EmptyState,
  Panel,
  PanelBody,
  PanelHeader,
  ResourceState,
  SkeletonBlock,
  SkeletonRows,
  StatusPill,
} from "@/components/owner/primitives";
import { dateTimeLabel, formatRelativeTime } from "@/lib/owner/format";
import { useForecast, useSalesSeries } from "@/lib/owner/hooks";
import type {
  AiAlert,
  BestSeller,
  ForecastHorizon,
  Kpi,
  LowStockItem,
  QuickAction,
  RecentOrder,
  Resource,
  SalesMetric,
  SalesRange,
  SlowMover,
  VoiceAnalytics,
} from "@/lib/owner/types";
import { cn } from "@/lib/utils";

/* ------------------------------- Quick actions ------------------------------ */

export function QuickActions({ actions }: { actions: QuickAction[] }) {
  if (actions.length === 0) return null;
  return (
    <section aria-label="Quick actions" className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-5">
      {actions.map((action) => (
        <Link
          key={action.id}
          to={action.href}
          className={cn(
            "flex items-center gap-2.5 rounded-xl px-3.5 py-3 text-sm font-semibold transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan focus-visible:ring-offset-2",
            action.primary
              ? "bg-brand-gradient text-white shadow-[0_14px_28px_-16px_rgba(0,191,174,0.85)]"
              : "border border-brand-border bg-white text-brand-navy-deep hover:border-brand-teal/40 ",
          )}
        >
          <OwnerIcon name={action.icon} className="h-4.5 w-4.5 shrink-0" />
          <span className="truncate">{action.label}</span>
        </Link>
      ))}
    </section>
  );
}

/* ---------------------------------- KPIs ---------------------------------- */

const TREND_ICON = { up: ArrowUpRight, down: ArrowDownRight, flat: Minus };

export function KpiGrid({ kpis, isLoading }: { kpis: Kpi[]; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <SkeletonBlock key={index} className="h-28 w-full rounded-2xl" />
        ))}
      </div>
    );
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {kpis.map((kpi) => {
        const TrendIcon = kpi.trend ? TREND_ICON[kpi.trend] : null;
        return (
          <Link
            key={kpi.id}
            to={kpi.href}
            className="group rounded-2xl border border-brand-border-subtle bg-white p-4 shadow-[0_10px_24px_-20px_rgba(7,27,51,0.3)] transition-all hover:-translate-y-0.5 hover:border-brand-teal/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan "
          >
            <div className="flex items-start justify-between gap-2">
              <span
                className={cn(
                  "grid h-9 w-9 shrink-0 place-items-center rounded-xl",
                  kpi.tone === "critical"
                    ? "bg-destructive/10 text-brand-danger"
                    : kpi.tone === "warning"
                      ? "bg-amber-500/12 text-brand-warning"
                      : "bg-brand-teal/10 text-brand-accent",
                )}
              >
                <OwnerIcon name={kpi.icon} className="h-4.5 w-4.5" />
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 text-brand-muted opacity-0 transition-opacity group-hover:opacity-100 rtl:-scale-x-100" />
            </div>
            <p className="mt-3 truncate text-xs font-semibold uppercase tracking-wide text-brand-muted">
              {kpi.label}
            </p>
            <p className="mt-1 truncate text-2xl font-black text-brand-navy-deep ">{kpi.value}</p>
            <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-brand-secondary-text ">
              {TrendIcon ? <TrendIcon className="h-3.5 w-3.5 shrink-0" /> : null}
              {kpi.subtitle}
            </p>
          </Link>
        );
      })}
    </div>
  );
}

/* ------------------------------- Sales chart ------------------------------ */

const RANGES: { id: SalesRange; label: string }[] = [
  { id: "daily", label: "Daily" },
  { id: "weekly", label: "Weekly" },
  { id: "monthly", label: "Monthly" },
];

const METRICS: { id: SalesMetric; label: string }[] = [
  { id: "revenue", label: "Revenue" },
  { id: "orders", label: "Orders" },
  { id: "average-order", label: "Avg. Order" },
];

export function SalesAnalyticsPanel() {
  const [range, setRange] = useState<SalesRange>("daily");
  const [metric, setMetric] = useState<SalesMetric>("revenue");
  const { data, isLoading, error, refetch } = useSalesSeries(range, metric);
  const points = data?.points ?? [];

  return (
    <Panel>
      <PanelHeader title="Sales & Revenue" description={`Total: ${data?.total ?? "—"}`}>
        <Segmented options={RANGES} value={range} onChange={setRange} />
      </PanelHeader>
      <PanelBody className="space-y-4">
        <Segmented options={METRICS} value={metric} onChange={setMetric} />
        <div className="h-[240px] sm:h-[280px] lg:h-[320px]">
          <ResourceState
            isLoading={isLoading}
            error={error}
            isEmpty={points.length === 0}
            onRetry={refetch}
            emptyTitle="No sales data for this range"
            emptyDescription="Aggregated sales will appear here once orders are recorded."
            skeleton={<SkeletonBlock className="h-full w-full rounded-xl" />}
          >
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
                <defs>
                  <linearGradient id="ownerSalesFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--brand-cyan)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--brand-cyan)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--brand-border)"
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "var(--brand-muted)" }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "var(--brand-muted)" }}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid var(--brand-border)",
                    fontSize: 12,
                  }}
                  formatter={(value: number) => [`${value}${data?.unit ?? ""}`, metric]}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="var(--brand-teal)"
                  strokeWidth={2.5}
                  fill="url(#ownerSalesFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </ResourceState>
        </div>
      </PanelBody>
    </Panel>
  );
}

function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <div className="inline-flex rounded-xl bg-brand-surface-2 p-1 ">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => onChange(option.id)}
          aria-pressed={value === option.id}
          className={cn(
            "rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan",
            value === option.id
              ? "bg-white text-brand-navy-deep shadow-sm "
              : "text-brand-secondary-text hover:text-brand-navy-deep ",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------ Product panels ---------------------------- */

type ListPanelProps = {
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
};

export function BestSellersPanel({ items, ...state }: ListPanelProps & { items: BestSeller[] }) {
  const top = items.slice(0, 5);
  const maximum = Math.max(...top.map((item) => item.unitsSold), 1);
  return (
    <Panel>
      <PanelHeader
        title="Best-Selling Products"
        description="Top 5"
        actionLabel="View All"
        actionTo="/owner/analytics"
      />
      <PanelBody>
        <ResourceState
          {...state}
          isEmpty={items.length === 0}
          emptyTitle="No sales ranked yet"
          emptyDescription="Top products appear once sales are aggregated."
        >
          <ol className="space-y-4">
            {top.map((item) => (
              <li key={item.id} className="grid grid-cols-[24px_minmax(0,1fr)_auto] items-center gap-3">
                <span className="text-center text-xs font-black text-brand-accent">{item.rank}</span>
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center justify-between gap-3">
                    <span className="truncate text-sm font-semibold text-brand-navy-deep">{item.product}</span>
                    <span className="shrink-0 text-xs text-brand-secondary-text">{item.revenue}</span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-brand-surface-2">
                    <div className="h-full rounded-full bg-brand-gradient" style={{ width: `${(item.unitsSold / maximum) * 100}%` }} />
                  </div>
                </div>
                <span className="w-16 shrink-0 text-end text-xs font-bold text-brand-navy-deep">{item.unitsSold} units</span>
              </li>
            ))}
          </ol>
        </ResourceState>
      </PanelBody>
    </Panel>
  );
}

export function SlowMoversPanel({ items, ...state }: ListPanelProps & { items: SlowMover[] }) {
  const maximum = Math.max(...items.map((item) => item.unitsSold), 1);
  return (
    <Panel>
      <PanelHeader
        title="Slow-Moving Products"
        description="Worth a closer look"
        actionLabel="View All"
        actionTo="/owner/analytics"
      />
      <PanelBody>
        <ResourceState
          {...state}
          isEmpty={items.length === 0}
          emptyTitle="Nothing flagged"
          emptyDescription="Products with low movement will be listed here."
        >
          <ul className="space-y-4">
            {items.map((item) => (
              <li key={item.id} className="min-w-0">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-brand-navy-deep">{item.product}</p>
                    <p className="mt-0.5 text-xs text-brand-secondary-text">Last sold {formatRelativeTime(item.lastSold)}</p>
                  </div>
                  <span className="shrink-0 text-xs font-semibold text-brand-secondary-text">Stock {item.currentStock}</span>
                </div>
                <div className="mt-2 grid grid-cols-[minmax(0,1fr)_56px] items-center gap-3">
                  <div className="h-2 overflow-hidden rounded-full bg-brand-surface-2"><div className="h-full rounded-full bg-brand-warning" style={{ width: `${(item.unitsSold / maximum) * 100}%` }} /></div>
                  <span className="text-end text-xs font-bold text-brand-navy-deep">{item.unitsSold} sold</span>
                </div>
              </li>
            ))}
          </ul>
        </ResourceState>
      </PanelBody>
    </Panel>
  );
}

export function LowStockPanel({ items, ...state }: ListPanelProps & { items: LowStockItem[] }) {
  return (
    <Panel>
      <PanelHeader
        title="Low Stock Alerts"
        description="Reorder suggestions ready for review"
        actionLabel="View All"
        actionTo="/owner/inventory"
      />
      <PanelBody>
        <ResourceState
          {...state}
          isEmpty={items.length === 0}
          emptyTitle="Stock levels look healthy"
          emptyDescription="Products below their threshold will appear here with reorder suggestions."
        >
          <ul className="divide-y divide-brand-border-subtle">
            {items.map((item) => (
              <li key={item.id} className="grid gap-3 py-3 first:pt-0 last:pb-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <div className="flex min-w-0 items-start gap-3">
                  <span className={cn("mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg", item.status === "critical" ? "bg-destructive/10 text-brand-danger" : "bg-amber-500/12 text-brand-warning")}><AlertTriangle className="h-4 w-4" /></span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2"><p className="text-sm font-bold text-brand-navy-deep">{item.product}</p><StatusPill label={item.status} tone={item.status === "critical" ? "critical" : "warning"} /></div>
                    <p className="mt-1 text-xs text-brand-secondary-text">Stock {item.currentStock} · Threshold {item.threshold} · Reorder {item.suggestedReorder}</p>
                    <p className="mt-0.5 truncate text-xs text-brand-secondary-text">Supplier: {item.preferredSupplier}</p>
                  </div>
                </div>
                <Link to={item.href} className="inline-flex min-h-10 items-center justify-center rounded-lg border border-brand-border px-3 text-xs font-semibold text-brand-accent hover:bg-brand-surface-2">Review</Link>
              </li>
            ))}
          </ul>
        </ResourceState>
      </PanelBody>
    </Panel>
  );
}

export function RecentOrdersPanel({ items, ...state }: ListPanelProps & { items: RecentOrder[] }) {
  return (
    <Panel>
      <PanelHeader
        title="Recent Orders"
        description="Latest incoming orders"
        actionLabel="View All"
        actionTo="/owner/orders"
      />
      <PanelBody>
        <ResourceState
          {...state}
          isEmpty={items.length === 0}
          emptyTitle="No orders yet"
          emptyDescription="Incoming customer orders will stream into this table."
        >
          <ul className="divide-y divide-brand-border-subtle">
            {items.slice(0, 5).map((item) => (
              <li key={item.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><Link to={item.href} className="text-sm font-bold text-brand-accent hover:underline">{item.reference}</Link><StatusPill label={item.status} tone="info" /></div><p className="mt-1 truncate text-xs text-brand-secondary-text">{item.customer} · {item.items} items · {item.payment}</p></div>
                <div className="shrink-0 text-end"><p className="text-sm font-bold text-brand-navy-deep">{item.total}</p><p className="mt-1 text-xs text-brand-secondary-text">{dateTimeLabel(item.placedAt)}</p></div>
              </li>
            ))}
          </ul>
        </ResourceState>
      </PanelBody>
    </Panel>
  );
}

/* --------------------------- Voice order analytics ------------------------ */

export function VoiceAnalyticsPanel({
  voice,
  ...state
}: ListPanelProps & { voice: VoiceAnalytics | null }) {
  const hasData =
    !!voice && (voice.languages.length > 0 || voice.peakHours.length > 0 || voice.voiceShare > 0);

  return (
    <Panel>
      <PanelHeader
        title="Voice Ordering Analytics"
        description="Voice vs text performance"
        actionLabel="View All"
        actionTo="/owner/voice-analytics"
      />
      <PanelBody className="space-y-4">
        <ResourceState
          {...state}
          isEmpty={!hasData}
          emptyTitle="No voice orders recorded"
          emptyDescription="Voice usage, languages and peak hours will appear here."
        >
          <div className="space-y-4">
            <div className="grid items-center gap-4 sm:grid-cols-[180px_minmax(0,1fr)]">
              <div className="relative mx-auto h-40 w-40"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={[{ name: "Voice", value: voice?.voiceShare ?? 0 }, { name: "Text", value: voice?.textShare ?? 0 }]} dataKey="value" innerRadius={52} outerRadius={72} strokeWidth={0}>{["var(--brand-teal)", "var(--brand-border)"].map((fill) => <Cell key={fill} fill={fill} />)}</Pie><Tooltip formatter={(value: number) => `${value}%`} /></PieChart></ResponsiveContainer><div className="pointer-events-none absolute inset-0 grid place-content-center text-center"><span className="text-xl font-black text-brand-navy-deep">{voice?.voiceShare ?? 0}%</span><span className="text-[11px] text-brand-secondary-text">Voice</span></div></div>
              <div className="grid grid-cols-2 gap-3"><Metric label="Total Voice Orders" value={voice?.totalVoiceOrders ?? "—"} /><Metric label="Text Share" value={`${voice?.textShare ?? 0}%`} /></div>
            </div>
            <ShareBars title="Language Distribution" rows={voice?.languages ?? []} />
            <div><p className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">Peak Ordering Hours</p><div className="mt-2 h-36"><ResponsiveContainer width="100%" height="100%"><BarChart data={voice?.peakHours ?? []}><CartesianGrid stroke="var(--brand-border)" vertical={false} /><XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "var(--brand-muted)" }} /><Tooltip formatter={(value: number) => `${value}%`} /><Bar dataKey="share" fill="var(--brand-cyan)" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div></div>
          </div>
        </ResourceState>
      </PanelBody>
    </Panel>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-brand-surface-2 p-3 ">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">{label}</p>
      <p className="mt-1 truncate text-lg font-black text-brand-navy-deep ">{value}</p>
    </div>
  );
}

function ShareBars({ title, rows }: { title: string; rows: { label: string; share: number }[] }) {
  if (rows.length === 0) return null;
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">{title}</p>
      <ul className="mt-2 space-y-2">
        {rows.map((row) => (
          <li key={row.label} className="flex items-center gap-3">
            <span className="w-24 shrink-0 truncate text-xs font-semibold text-brand-navy-deep ">
              {row.label}
            </span>
            <span className="h-2 flex-1 overflow-hidden rounded-full bg-brand-surface-2 ">
              <span
                className="bg-brand-gradient block h-full rounded-full"
                style={{ width: `${Math.min(Math.max(row.share, 0), 100)}%` }}
              />
            </span>
            <span className="w-10 shrink-0 text-end text-xs text-brand-secondary-text">
              {row.share}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------- AI forecast ------------------------------ */

const HORIZONS: { id: ForecastHorizon; label: string }[] = [
  { id: "tomorrow", label: "Tomorrow" },
  { id: "3-days", label: "Next 3 Days" },
  { id: "7-days", label: "Next 7 Days" },
  { id: "30-days", label: "Next 30 Days" },
];

export function ForecastPanel() {
  const [horizon, setHorizon] = useState<ForecastHorizon>("7-days");
  const { data, isLoading, error, refetch } = useForecast(horizon);
  const rows = data?.rows ?? [];

  return (
    <Panel>
      <PanelHeader
        title="AI Demand Forecast"
        description="Recommendations only — the final call is yours"
        actionLabel="View All"
        actionTo="/owner/forecast"
      />
      <PanelBody className="space-y-4">
        <div className="scroll-rail overflow-x-auto">
          <Segmented options={HORIZONS} value={horizon} onChange={setHorizon} />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Metric label="Needing Attention" value={String(data?.needingAttention ?? 0)} />
          <Metric label="High Demand" value={String(data?.highDemand ?? 0)} />
          <Metric label="Potential Stockouts" value={String(data?.potentialStockouts ?? 0)} />
        </div>
        <ResourceState
          isLoading={isLoading}
          error={error}
          isEmpty={rows.length === 0}
          onRetry={refetch}
          emptyTitle="No forecast available"
          emptyDescription="Predicted demand appears once enough sales history is available."
        >
          <ul className="space-y-4">
            {rows.slice(0, 5).map((row) => {
              const maximum = Math.max(row.currentStock, row.predictedDemand, 1);
              return <li key={row.id} className="min-w-0"><div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3"><div className="min-w-0"><p className="truncate text-sm font-bold text-brand-navy-deep">{row.product}</p><p className="mt-0.5 text-xs text-brand-secondary-text">{row.daysUntilStockout === null ? "No stockout predicted" : `${row.daysUntilStockout} days to stockout`}</p></div><StatusPill label={row.recommendation} tone={row.difference < 0 ? "critical" : "success"} /></div><div className="mt-2 grid grid-cols-[64px_minmax(0,1fr)_36px] items-center gap-2 text-xs"><span className="text-brand-secondary-text">Stock</span><div className="h-2 overflow-hidden rounded-full bg-brand-surface-2"><div className="h-full rounded-full bg-brand-teal" style={{ width: `${(row.currentStock / maximum) * 100}%` }} /></div><span className="text-end font-semibold">{row.currentStock}</span><span className="text-brand-secondary-text">Demand</span><div className="h-2 overflow-hidden rounded-full bg-brand-surface-2"><div className="h-full rounded-full bg-brand-cyan" style={{ width: `${(row.predictedDemand / maximum) * 100}%` }} /></div><span className="text-end font-semibold">{row.predictedDemand}</span></div></li>;
            })}
          </ul>
        </ResourceState>
      </PanelBody>
    </Panel>
  );
}

/* -------------------------------- AI alerts ------------------------------- */

const SEVERITY_TONE = { critical: "critical", warning: "warning", info: "info" } as const;

export function AiAlertsPanel({ items, ...state }: ListPanelProps & { items: AiAlert[] }) {
  return (
    <Panel>
      <PanelHeader title="AI Alerts" description="Critical, warning and informational" />
      <PanelBody className="space-y-3">
        <ResourceState
          {...state}
          isEmpty={items.length === 0}
          emptyTitle="No AI alerts"
          emptyDescription="Stock risk and demand alerts will be raised here."
          skeleton={<SkeletonRows rows={3} />}
        >
          <ul className="space-y-3">
            {items.map((alert) => (
              <li key={alert.id} className="rounded-xl border border-brand-border-subtle p-3 ">
                <div className="flex items-start gap-3">
                  <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-lg", alert.severity === "critical" ? "bg-destructive/10 text-brand-danger" : alert.severity === "warning" ? "bg-amber-500/12 text-brand-warning" : "bg-brand-cyan/12 text-brand-info")}>{alert.severity === "critical" ? <AlertCircle className="h-4 w-4" /> : alert.severity === "warning" ? <AlertTriangle className="h-4 w-4" /> : <Info className="h-4 w-4" />}</span>
                  <p className="min-w-0 flex-1 text-sm font-semibold text-brand-navy-deep ">
                    {alert.message}
                  </p>
                  <StatusPill label={alert.severity} tone={SEVERITY_TONE[alert.severity]} />
                </div>
                <dl className="mt-2.5 grid grid-cols-3 gap-2 text-xs">
                  <Stat label="Stock" value={alert.currentStock} />
                  <Stat label="Predicted" value={alert.predictedDemand} />
                  <Stat label="Reorder" value={alert.suggestedReorder} />
                </dl>
                <Link
                  to="/owner/forecast"
                  className="mt-2.5 inline-flex items-center gap-1 text-xs font-semibold text-brand-accent hover:underline"
                >
                  View Forecast
                  <ArrowRight className="h-3.5 w-3.5 rtl:-scale-x-100" />
                </Link>
              </li>
            ))}
          </ul>
        </ResourceState>
      </PanelBody>
    </Panel>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-brand-muted">{label}</dt>
      <dd className="font-bold text-brand-navy-deep ">{value}</dd>
    </div>
  );
}

/** Re-exported so pages can build their own resource-driven sections. */
export type { Resource };

export function EmptySectionNotice({ title }: { title: string }) {
  return (
    <Panel>
      <PanelBody>
        <EmptyState title={title} description="This section is ready for backend data." />
      </PanelBody>
    </Panel>
  );
}
