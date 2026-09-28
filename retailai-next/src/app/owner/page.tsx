"use client";

import { Panel, PanelBody } from "@/components/owner/primitives";
import {
  AiAlertsPanel,
  BestSellersPanel,
  ForecastPanel,
  KpiGrid,
  LowStockPanel,
  QuickActions,
  RecentOrdersPanel,
  SalesAnalyticsPanel,
  SlowMoversPanel,
  VoiceAnalyticsPanel,
} from "@/components/owner/widgets";
import {
  PurchaseOrdersPanel,
  ReceivingPanel,
  SupplierKhataPanel,
} from "@/components/owner/workflow-widgets";
import { useOwnerDashboard } from "@/lib/owner/hooks";
import { useAccess } from "@/lib/owner/access";
import type { ActionId } from "@/lib/owner/permissions";



function OwnerOverview() {
  const { data, isLoading, error, refetch } = useOwnerDashboard();
  const { can } = useAccess();
  const state = { isLoading, error, onRetry: refetch };

  // Widgets are permission-gated: unavailable ones are removed entirely and the
  // responsive grid reflows, so the layout never shows an empty slot.
  const kpis = (data?.kpis ?? []).filter((kpi) => !kpi.moduleId || can(kpi.moduleId, "view"));
  const quickActions = (data?.quickActions ?? []).filter(
    (action) =>
      !action.moduleId || can(action.moduleId, (action.requiredAction as ActionId) ?? "view"),
  );

  const hasSecondary = can("products") || can("purchase-orders") || can("supplier-khata") || can("voice-analytics") || can("ai-forecast");

  return (
    <div className="space-y-5 sm:space-y-6">
      <QuickActions actions={quickActions} />
      {kpis.length > 0 ? <KpiGrid kpis={kpis} isLoading={isLoading} /> : null}

      {can("analytics") ? <SalesAnalyticsPanel /> : null}

      {can("products") ? <div className="grid gap-5 xl:grid-cols-2"><BestSellersPanel items={data?.bestSellers ?? []} {...state} /><SlowMoversPanel items={data?.slowMovers ?? []} {...state} /></div> : null}
      {can("inventory") ? <LowStockPanel items={data?.lowStock ?? []} {...state} /> : null}
      {can("purchase-orders") ? <div className="grid gap-5 xl:grid-cols-2"><PurchaseOrdersPanel items={data?.purchaseOrders ?? []} {...state} /><ReceivingPanel items={data?.receiving ?? []} {...state} /></div> : null}
      {can("supplier-khata") || can("orders") ? <div className="grid gap-5 xl:grid-cols-2">{can("supplier-khata") ? <SupplierKhataPanel items={data?.supplierLedger ?? []} {...state} /> : null}{can("orders") ? <RecentOrdersPanel items={data?.recentOrders ?? []} {...state} /> : null}</div> : null}
      {can("voice-analytics") ? <VoiceAnalyticsPanel voice={data?.voice ?? null} {...state} /> : null}
      {can("ai-forecast") ? <div className="grid gap-5 xl:grid-cols-2"><ForecastPanel /><AiAlertsPanel items={data?.alerts ?? []} {...state} /></div> : null}

      {kpis.length === 0 && !hasSecondary && !can("analytics") && !can("orders") ? (
        <Panel>
          <PanelBody className="py-12 text-center">
            <h2 className="text-base font-bold text-brand-navy-deep ">Nothing assigned yet</h2>
            <p className="mx-auto mt-1 max-w-sm text-sm text-brand-secondary-text ">
              Your account has no dashboard modules granted. Ask the owner to assign permissions.
            </p>
          </PanelBody>
        </Panel>
      ) : null}
    </div>
  );
}

export default OwnerOverview;
