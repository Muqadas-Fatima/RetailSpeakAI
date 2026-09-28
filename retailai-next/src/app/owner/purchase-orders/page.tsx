"use client";

import { Check, Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { CollectionPage } from "@/components/owner/collection-page";
import { OwnerButton } from "@/components/owner/confirm-dialog";
import type { DataTableColumn, RowAction } from "@/components/owner/data-table";
import { SelectFilter } from "@/components/owner/filters";
import { PresetEmpty } from "@/components/owner/states";
import { StatusBadge } from "@/components/owner/status-badge";
import { NewPurchaseOrderDialog } from "@/components/owner/record-dialogs";
import type { FilterOption } from "@/components/owner/filters";
import {
  ApprovePurchaseOrderDialog,
  RejectPurchaseOrderDialog,
} from "@/components/owner/workflow-dialogs";
import { useAccess } from "@/lib/owner/access";
import { filterValue, useOwnerCollection } from "@/lib/owner/collection";
import { dateLabel, plainText } from "@/lib/owner/format";
import {
  PO_STATUS_OPTIONS,
  type PurchaseOrderRecord,
  approvePurchaseOrder,
  fetchPurchaseOrders,
  fetchSupplierOptions,
  raisePurchaseOrder,
  rejectPurchaseOrder,
} from "@/lib/owner/records";
import { ownerToast, ownerToastMessages } from "@/lib/owner/toast";

const DESCRIPTION = "Raise, approve and receive purchase orders from your suppliers.";



function OwnerPurchaseOrdersPage() {
  const { can } = useAccess();
  const collection = useOwnerCollection<PurchaseOrderRecord>(fetchPurchaseOrders, {
    initialSort: { columnId: "createdAt", direction: "desc" },
  });
  const [approving, setApproving] = useState<PurchaseOrderRecord | null>(null);
  const [rejecting, setRejecting] = useState<PurchaseOrderRecord | null>(null);
  const [creating, setCreating] = useState(false);
  const [suppliers, setSuppliers] = useState<FilterOption[]>([]);

  // Supplier options are read from the shared supplier state.
  useEffect(() => {
    if (!creating) return;
    let cancelled = false;
    void fetchSupplierOptions().then((options) => {
      if (!cancelled) setSuppliers(options);
    });
    return () => {
      cancelled = true;
    };
  }, [creating]);

  const canDecide = (row: PurchaseOrderRecord) =>
    ["draft", "awaiting_approval", "pending"].includes(row.status.toLowerCase());

  const columns: DataTableColumn<PurchaseOrderRecord>[] = [
    {
      id: "reference",
      header: "Reference",
      sortable: true,
      hideOnCard: true,
      cell: (row) => <span className="font-bold text-brand-navy-deep ">{row.reference}</span>,
    },
    {
      id: "supplierName",
      header: "Supplier",
      sortable: true,
      cell: (row) => plainText(row.supplierName),
    },
    { id: "itemCount", header: "Items", align: "end", cell: (row) => row.itemCount },
    {
      id: "total",
      header: "Total",
      sortable: true,
      align: "end",
      cell: (row) => (
        <span className="font-bold text-brand-navy-deep ">{plainText(row.total)}</span>
      ),
    },
    { id: "status", header: "Status", cell: (row) => <StatusBadge status={row.status} /> },
    { id: "expectedAt", header: "Expected", cell: (row) => dateLabel(row.expectedAt) },
    { id: "createdAt", header: "Created", sortable: true, cell: (row) => dateLabel(row.createdAt) },
  ];

  const actions: RowAction<PurchaseOrderRecord>[] = [
    {
      id: "approve",
      label: "Approve",
      icon: <Check className="h-4 w-4" />,
      onSelect: (row) => setApproving(row),
      hidden: (row) => !can("purchase-orders", "approve") || !canDecide(row),
    },
    {
      id: "reject",
      label: "Reject",
      tone: "danger",
      icon: <X className="h-4 w-4" />,
      onSelect: (row) => setRejecting(row),
      hidden: (row) => !can("purchase-orders", "reject") || !canDecide(row),
    },
  ];

  return (
    <>
      <CollectionPage<PurchaseOrderRecord>
        title="Purchase Orders"
        description={DESCRIPTION}
        collection={collection}
        columns={columns}
        rowKey={(row) => row.id}
        cardTitle={(row) => row.reference}
        actions={actions}
        searchLabel="Search purchase orders"
        searchPlaceholder="Search by reference or supplier"
        empty={<PresetEmpty preset="purchaseOrders" />}
        headerAction={
          can("purchase-orders", "create") ? (
            <OwnerButton className="px-3 py-2 text-xs" onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" />
              New order
            </OwnerButton>
          ) : null
        }
        filters={
          <SelectFilter
            label="Status"
            value={filterValue(collection.filters, "status")}
            options={PO_STATUS_OPTIONS}
            onChange={(value) => collection.setFilter("status", value)}
            allLabel="All statuses"
          />
        }
      />

      <ApprovePurchaseOrderDialog
        open={approving !== null}
        order={approving}
        onClose={() => setApproving(null)}
        onConfirm={async (input) => {
          await approvePurchaseOrder(input);
          ownerToast.success(ownerToastMessages.purchaseOrderApproved(approving?.reference ?? ""));
        }}
      />
      <RejectPurchaseOrderDialog
        open={rejecting !== null}
        order={rejecting}
        onClose={() => setRejecting(null)}
        onConfirm={async (input) => {
          await rejectPurchaseOrder(input);
          ownerToast.success(ownerToastMessages.purchaseOrderRejected(rejecting?.reference ?? ""));
        }}
      />

      <NewPurchaseOrderDialog
        open={creating}
        suppliers={suppliers}
        onClose={() => setCreating(false)}
        onSubmit={async (values) => {
          const record = await raisePurchaseOrder(values);
          ownerToast.success(`${record.reference} raised for ${record.supplierName}`);
        }}
      />
    </>
  );
}

export default OwnerPurchaseOrdersPage;
