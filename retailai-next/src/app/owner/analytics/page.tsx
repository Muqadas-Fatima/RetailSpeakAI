"use client";

import {
  BestSellersPanel,
  KpiGrid,
  SalesAnalyticsPanel,
  SlowMoversPanel,
} from "@/components/owner/widgets";
import { useOwnerDashboard } from "@/lib/owner/hooks";

const DESCRIPTION = "Sales trends, best sellers and slow movers across your business.";



function OwnerAnalyticsPage() {
  const { data, isLoading, error, refetch } = useOwnerDashboard();

  return (
    <div className="space-y-4 sm:space-y-5">
      <KpiGrid kpis={data?.kpis ?? []} isLoading={isLoading} />
      <SalesAnalyticsPanel />
      <div className="grid gap-4 xl:grid-cols-2">
        <BestSellersPanel
          items={data?.bestSellers ?? []}
          isLoading={isLoading}
          error={error}
          onRetry={refetch}
        />
        <SlowMoversPanel
          items={data?.slowMovers ?? []}
          isLoading={isLoading}
          error={error}
          onRetry={refetch}
        />
      </div>
    </div>
  );
}

export default OwnerAnalyticsPage;
