"use client";
import { Link } from "@/lib/router-compat";
import { Panel, PanelBody, PanelHeader, ResourceState, StatusPill } from "@/components/owner/primitives";
import type { PurchaseOrderSummary, ReceivingTask, SupplierLedgerEntry } from "@/lib/owner/types";

type PanelState = { isLoading: boolean; error: string | null; onRetry: () => void };

const PO_TONE = {
  draft: "neutral",
  "pending-approval": "warning",
  sent: "info",
  "partially-received": "warning",
  received: "success",
} as const;

export function PurchaseOrdersPanel({
  items,
  ...state
}: PanelState & { items: PurchaseOrderSummary[] }) {
  const stages = (["pending-approval", "sent", "partially-received", "received"] as const).map((stage) => ({ stage, count: items.filter((item) => item.stage === stage).length }));
  return (
    <Panel>
      <PanelHeader
        title="Purchase Orders"
        description="Draft → Approval → Sent → Received"
        actionLabel="View All"
        actionTo="/owner/purchase-orders"
      />
      <PanelBody>
        <ResourceState
          {...state}
          isEmpty={items.length === 0}
          emptyTitle="No purchase orders"
          emptyDescription="AI-suggested and manual purchase orders will be listed here for approval."
        >
          <div className="space-y-4"><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{stages.map(({ stage, count }) => <div key={stage} className="rounded-xl bg-brand-surface-2 p-3"><p className="text-xl font-black text-brand-navy-deep">{count}</p><p className="mt-0.5 text-[11px] font-semibold capitalize text-brand-secondary-text">{stage.replace(/-/g, " ")}</p></div>)}</div><ul className="divide-y divide-brand-border-subtle">{items.slice(0, 3).map((item) => <li key={item.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 py-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><Link to={item.href} className="text-sm font-bold text-brand-accent hover:underline">{item.reference}</Link><StatusPill label={item.stage.replace(/-/g, " ")} tone={PO_TONE[item.stage]} /></div><p className="mt-1 truncate text-xs text-brand-secondary-text">{item.supplier} · {item.itemCount} items</p></div><div className="text-end"><p className="text-sm font-bold text-brand-navy-deep">{item.total}</p><p className="mt-1 text-xs text-brand-secondary-text">{new Date(item.expectedAt).toLocaleDateString()}</p></div></li>)}</ul></div>
        </ResourceState>
      </PanelBody>
    </Panel>
  );
}

const LEDGER_TONE = { overdue: "critical", "due-soon": "warning", settled: "success" } as const;

export function SupplierKhataPanel({
  items,
  ...state
}: PanelState & { items: SupplierLedgerEntry[] }) {
  const balances = items.map((item) => Number(item.balance.replace(/[^0-9.-]/g, "")) || 0);
  const maximum = Math.max(...balances, 1);
  const total = balances.reduce((sum, value) => sum + value, 0);
  const currency = items[0]?.balance.replace(/[0-9,.-]/g, "").trim() || "";
  return (
    <Panel>
      <PanelHeader
        title="Supplier Khata"
        description="Outstanding balances and payments"
        actionLabel="View All"
        actionTo="/owner/khata"
      />
      <PanelBody>
        <ResourceState
          {...state}
          isEmpty={items.length === 0}
          emptyTitle="Ledger is empty"
          emptyDescription="Supplier balances, dues and payment history will appear here."
        >
          <div><div className="mb-5"><p className="text-xs font-semibold uppercase tracking-wide text-brand-muted">Total outstanding</p><p className="mt-1 text-2xl font-black text-brand-navy-deep">{currency} {total.toLocaleString()}</p></div><ul className="space-y-4">{items.map((item, index) => <li key={item.id}><div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="truncate text-sm font-bold text-brand-navy-deep">{item.supplier}</p><StatusPill label={item.status.replace(/-/g, " ")} tone={LEDGER_TONE[item.status]} /></div><p className="mt-0.5 truncate text-xs text-brand-secondary-text">{item.dueLabel}</p></div><Link to={item.href} className="text-end text-xs font-bold text-brand-accent hover:underline">{item.balance}</Link></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-brand-surface-2"><div className="h-full rounded-full bg-brand-gradient" style={{ width: `${((balances[index] ?? 0) / maximum) * 100}%` }} /></div></li>)}</ul></div>
        </ResourceState>
      </PanelBody>
    </Panel>
  );
}

const RECEIVE_TONE = { awaiting: "info", partial: "warning", complete: "success" } as const;

export function ReceivingPanel({ items, ...state }: PanelState & { items: ReceivingTask[] }) {
  const statuses = (["complete", "partial", "awaiting"] as const).map((status) => ({ status, count: items.filter((item) => item.status === status).length }));
  return (
    <Panel>
      <PanelHeader
        title="Receiving"
        description="Full and partial deliveries"
        actionLabel="View All"
        actionTo="/owner/purchase-orders"
      />
      <PanelBody>
        <ResourceState
          {...state}
          isEmpty={items.length === 0}
          emptyTitle="Nothing to receive"
          emptyDescription="Deliveries awaiting confirmation will be listed here."
        >
          <div className="space-y-4"><div className="grid grid-cols-3 gap-2">{statuses.map(({ status, count }) => <div key={status} className="rounded-xl bg-brand-surface-2 p-3 text-center"><p className="text-xl font-black text-brand-navy-deep">{count}</p><p className="mt-0.5 text-[11px] font-semibold capitalize text-brand-secondary-text">{status}</p></div>)}</div><ul className="space-y-3">
            {items.filter((item) => item.status !== "complete").slice(0, 2).map((item) => (
              <li key={item.id} className="rounded-xl border border-brand-border-subtle p-3 ">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-brand-navy-deep ">
                      {item.reference}
                    </p>
                    <p className="truncate text-xs text-brand-secondary-text ">
                      {item.supplier} · {item.receivedItems}/{item.expectedItems} items
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <StatusPill label={item.status} tone={RECEIVE_TONE[item.status]} />
                    <Link
                      to={item.href}
                      className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-brand-accent transition-colors hover:bg-brand-surface-2 "
                    >
                      Receive
                    </Link>
                  </div>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-brand-surface-2"><div className="h-full rounded-full bg-brand-teal" style={{ width: `${item.expectedItems > 0 ? (item.receivedItems / item.expectedItems) * 100 : 0}%` }} /></div>
              </li>
            ))}
          </ul></div>
        </ResourceState>
      </PanelBody>
    </Panel>
  );
}
