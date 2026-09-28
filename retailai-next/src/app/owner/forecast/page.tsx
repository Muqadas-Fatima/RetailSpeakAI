"use client";

import { CollectionPage } from "@/components/owner/collection-page";
import type { DataTableColumn } from "@/components/owner/data-table";
import { SelectFilter } from "@/components/owner/filters";
import { PresetEmpty } from "@/components/owner/states";
import { StatusBadge } from "@/components/owner/status-badge";
import { AiAlertsPanel, ForecastPanel } from "@/components/owner/widgets";
import { filterValue, useOwnerCollection } from "@/lib/owner/collection";
import { plainText } from "@/lib/owner/format";
import { useOwnerDashboard } from "@/lib/owner/hooks";
import { FORECAST_RISK_OPTIONS, type ForecastRow, fetchForecastRows } from "@/lib/owner/records";

const DESCRIPTION = "Predicted demand, reorder suggestions and AI alerts for your stock.";



function OwnerForecastPage() {
  const dashboard = useOwnerDashboard();
  const collection = useOwnerCollection<ForecastRow>(fetchForecastRows, {
    initialSort: { columnId: "predictedDemand", direction: "desc" },
  });

  const columns: DataTableColumn<ForecastRow>[] = [
    {
      id: "productName",
      header: "Item",
      sortable: true,
      hideOnCard: true,
      cell: (row) => (
        <span className="min-w-0">
          <span className="block truncate font-bold text-brand-navy-deep ">{row.productName}</span>
          <span className="block truncate text-xs text-brand-muted">{plainText(row.category)}</span>
        </span>
      ),
    },
    { id: "currentStock", header: "In stock", align: "end", cell: (row) => row.currentStock },
    {
      id: "predictedDemand",
      header: "Predicted demand",
      sortable: true,
      align: "end",
      cell: (row) => <span className="font-bold text-brand-navy-deep ">{row.predictedDemand}</span>,
    },
    {
      id: "suggestedReorder",
      header: "Suggested reorder",
      align: "end",
      cell: (row) => row.suggestedReorder,
    },
    {
      id: "confidence",
      header: "Confidence",
      align: "end",
      cell: (row) => plainText(row.confidence),
    },
    { id: "riskStatus", header: "Risk", cell: (row) => <StatusBadge status={row.riskStatus} /> },
  ];

  return (
    <CollectionPage<ForecastRow>
      title="Forecast detail"
      description="Item-level demand predictions and reorder guidance."
      collection={collection}
      columns={columns}
      rowKey={(row) => row.id}
      cardTitle={(row) => row.productName}
      searchLabel="Search forecast"
      searchPlaceholder="Search by item or category"
      empty={<PresetEmpty preset="forecast" />}
      filters={
        <SelectFilter
          label="Risk"
          value={filterValue(collection.filters, "risk")}
          options={FORECAST_RISK_OPTIONS}
          onChange={(value) => collection.setFilter("risk", value)}
          allLabel="All items"
        />
      }
    >
      <div className="grid gap-4 xl:grid-cols-2">
        <ForecastPanel />
        <AiAlertsPanel
          items={dashboard.data?.alerts ?? []}
          isLoading={dashboard.isLoading}
          error={dashboard.error}
          onRetry={dashboard.refetch}
        />
      </div>
    </CollectionPage>
  );
}

export default OwnerForecastPage;
