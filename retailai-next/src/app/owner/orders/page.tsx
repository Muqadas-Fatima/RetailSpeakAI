"use client";

import { Bike, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { CollectionPage } from "@/components/owner/collection-page";
import type { DataTableColumn, RowAction } from "@/components/owner/data-table";
import { SelectFilter, type FilterOption } from "@/components/owner/filters";
import { AssignRiderDialog, OrderStatusDialog } from "@/components/owner/record-dialogs";
import { PresetEmpty } from "@/components/owner/states";
import { StatusBadge } from "@/components/owner/status-badge";
import { filterValue, useOwnerCollection } from "@/lib/owner/collection";
import { useAccess } from "@/lib/owner/access";
import {
  ORDER_CHANNEL_OPTIONS,
  ORDER_STATUS_OPTIONS,
  type OwnerOrder,
  assignOrderRider,
  fetchAvailableRiders,
  fetchOrders,
  setOrderStatus,
} from "@/lib/owner/records";
import { ownerToast } from "@/lib/owner/toast";
import { dateTimeLabel, plainText } from "@/lib/owner/format";

const DESCRIPTION = "Incoming, active and completed orders with status workflow.";



const columns: DataTableColumn<OwnerOrder>[] = [
  {
    id: "reference",
    header: "Order",
    sortable: true,
    hideOnCard: true,
    cell: (row) => <span className="font-bold text-brand-navy-deep ">{row.reference}</span>,
  },
  {
    id: "customer",
    header: "Customer",
    sortable: true,
    cell: (row) => plainText(row.customerName),
  },
  {
    id: "channel",
    header: "Channel",
    cell: (row) =>
      ORDER_CHANNEL_OPTIONS.find((option) => option.value === row.channel)?.label ?? row.channel,
  },
  { id: "items", header: "Items", cell: (row) => row.itemCount },
  {
    id: "total",
    header: "Total",
    sortable: true,
    align: "end",
    cell: (row) => <span className="font-bold text-brand-navy-deep ">{plainText(row.total)}</span>,
  },
  { id: "status", header: "Status", cell: (row) => <StatusBadge status={row.status} /> },
  { id: "rider", header: "Rider", cell: (row) => plainText(row.riderName) },
  { id: "placedAt", header: "Placed", sortable: true, cell: (row) => dateTimeLabel(row.placedAt) },
];

function OwnerOrdersPage() {
  const { can } = useAccess();
  const collection = useOwnerCollection<OwnerOrder>(fetchOrders, {
    initialSort: { columnId: "placedAt", direction: "desc" },
  });
  const [statusOrder, setStatusOrder] = useState<OwnerOrder | null>(null);
  const [riderOrder, setRiderOrder] = useState<OwnerOrder | null>(null);
  const [riders, setRiders] = useState<FilterOption[]>([]);

  // Rider options come from the shared rider state, so Orders and Riders agree.
  useEffect(() => {
    if (riderOrder === null) return;
    let cancelled = false;
    void fetchAvailableRiders().then((options) => {
      if (!cancelled) setRiders(options);
    });
    return () => {
      cancelled = true;
    };
  }, [riderOrder]);

  const actions: RowAction<OwnerOrder>[] = [
    {
      id: "status",
      label: "Update status",
      icon: <RefreshCw className="h-4 w-4" />,
      onSelect: (row) => setStatusOrder(row),
      hidden: () => !can("orders", "edit"),
    },
    {
      id: "rider",
      label: "Assign rider",
      icon: <Bike className="h-4 w-4" />,
      onSelect: (row) => setRiderOrder(row),
      hidden: (row) =>
        !can("orders", "edit") || ["delivered", "cancelled"].includes(row.status),
    },
  ];

  return (
    <>
    <CollectionPage<OwnerOrder>
      title="Orders"
      description={DESCRIPTION}
      collection={collection}
      columns={columns}
      rowKey={(row) => row.id}
      cardTitle={(row) => row.reference}
      actions={actions}
      searchLabel="Search orders"
      searchPlaceholder="Search by order or customer"
      empty={<PresetEmpty preset="orders" />}
      filters={
        <>
          <SelectFilter
            label="Status"
            value={filterValue(collection.filters, "status")}
            options={ORDER_STATUS_OPTIONS}
            onChange={(value) => collection.setFilter("status", value)}
            allLabel="All statuses"
          />
          <SelectFilter
            label="Channel"
            value={filterValue(collection.filters, "channel")}
            options={ORDER_CHANNEL_OPTIONS}
            onChange={(value) => collection.setFilter("channel", value)}
            allLabel="All channels"
          />
        </>
      }
    />

      <OrderStatusDialog
        open={statusOrder !== null}
        order={statusOrder}
        onClose={() => setStatusOrder(null)}
        onSubmit={async (input) => {
          await setOrderStatus(input);
          ownerToast.success(`${statusOrder?.reference ?? "Order"} updated`);
        }}
      />

      <AssignRiderDialog
        open={riderOrder !== null}
        order={riderOrder}
        riders={riders}
        onClose={() => setRiderOrder(null)}
        onSubmit={async (input) => {
          await assignOrderRider(input);
          ownerToast.success(
            input.riderName
              ? `${input.riderName} assigned to ${riderOrder?.reference ?? "order"}`
              : `Rider cleared for ${riderOrder?.reference ?? "order"}`,
          );
        }}
      />
    </>
  );
}

export default OwnerOrdersPage;
