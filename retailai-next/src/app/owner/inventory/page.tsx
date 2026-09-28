"use client";

import { useState } from "react";
import { CollectionPage } from "@/components/owner/collection-page";
import type { DataTableColumn, RowAction } from "@/components/owner/data-table";
import { SelectFilter } from "@/components/owner/filters";
import { PresetEmpty } from "@/components/owner/states";
import { StatusBadge } from "@/components/owner/status-badge";
import { AdjustStockDialog } from "@/components/owner/record-dialogs";
import { useAccess } from "@/lib/owner/access";
import { filterValue, useOwnerCollection } from "@/lib/owner/collection";
import { formatRelativeTime, plainText, quantityLabel } from "@/lib/owner/format";
import {
  STOCK_STATUS_OPTIONS,
  type InventoryRecord,
  adjustStock,
  fetchInventory,
} from "@/lib/owner/records";
import { ownerToast } from "@/lib/owner/toast";

const DESCRIPTION = "Stock on hand, reorder levels and low-stock warnings.";



function OwnerInventoryPage() {
  const { can } = useAccess();
  const collection = useOwnerCollection<InventoryRecord>(fetchInventory, {
    initialSort: { columnId: "onHand", direction: "asc" },
  });
  const [adjusting, setAdjusting] = useState<InventoryRecord | null>(null);

  const columns: DataTableColumn<InventoryRecord>[] = [
    {
      id: "productName",
      header: "Item",
      sortable: true,
      hideOnCard: true,
      cell: (row) => (
        <span className="min-w-0">
          <span className="block truncate font-bold text-brand-navy-deep ">{row.productName}</span>
          <span className="block truncate text-xs text-brand-muted">{plainText(row.sku)}</span>
        </span>
      ),
    },
    { id: "category", header: "Category", sortable: true, cell: (row) => plainText(row.category) },
    {
      id: "onHand",
      header: "On hand",
      sortable: true,
      align: "end",
      cell: (row) => (
        <span className="font-bold text-brand-navy-deep ">
          {quantityLabel(row.onHand, row.unit)}
        </span>
      ),
    },
    {
      id: "reorderLevel",
      header: "Reorder at",
      align: "end",
      cell: (row) => quantityLabel(row.reorderLevel, row.unit),
    },
    { id: "status", header: "Status", cell: (row) => <StatusBadge status={row.status} /> },
    { id: "updatedAt", header: "Updated", cell: (row) => formatRelativeTime(row.updatedAt) },
  ];

  const actions: RowAction<InventoryRecord>[] = [
    {
      id: "adjust",
      label: "Adjust stock",
      onSelect: (row) => setAdjusting(row),
      hidden: () => !can("inventory", "edit"),
    },
  ];

  return (
    <>
    <CollectionPage<InventoryRecord>
      title="Inventory"
      description={DESCRIPTION}
      collection={collection}
      columns={columns}
      rowKey={(row) => row.id}
      cardTitle={(row) => row.productName}
      actions={actions}
      searchLabel="Search inventory"
      searchPlaceholder="Search by item or SKU"
      empty={<PresetEmpty preset="inventory" />}
      filters={
        <SelectFilter
          label="Stock status"
          value={filterValue(collection.filters, "status")}
          options={STOCK_STATUS_OPTIONS}
          onChange={(value) => collection.setFilter("status", value)}
          allLabel="All levels"
        />
      }
    />

      <AdjustStockDialog
        open={adjusting !== null}
        record={adjusting}
        onClose={() => setAdjusting(null)}
        onSubmit={async (input) => {
          await adjustStock(input);
          ownerToast.success(`${adjusting?.productName ?? "Stock"} updated`);
        }}
      />
    </>
  );
}

export default OwnerInventoryPage;
