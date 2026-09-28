"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { CollectionPage } from "@/components/owner/collection-page";
import { ConfirmDialog, OwnerButton } from "@/components/owner/confirm-dialog";
import type { DataTableColumn, RowAction } from "@/components/owner/data-table";
import { SelectFilter } from "@/components/owner/filters";
import { Avatar } from "@/components/owner/primitives";
import { PresetEmpty } from "@/components/owner/states";
import { StatusBadge } from "@/components/owner/status-badge";
import { RiderFormDialog } from "@/components/owner/record-dialogs";
import { useAccess } from "@/lib/owner/access";
import { filterValue, useOwnerCollection } from "@/lib/owner/collection";
import { plainText } from "@/lib/owner/format";
import {
  RIDER_STATUS_OPTIONS,
  type RiderRecord,
  deleteRider,
  fetchRiders,
  upsertRider,
} from "@/lib/owner/records";
import { ownerToast } from "@/lib/owner/toast";

const DESCRIPTION = "Delivery riders, live availability and active assignments.";



function OwnerRidersPage() {
  const { can } = useAccess();
  const collection = useOwnerCollection<RiderRecord>(fetchRiders, {
    initialSort: { columnId: "name", direction: "asc" },
  });
  const [editing, setEditing] = useState<RiderRecord | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [removing, setRemoving] = useState<RiderRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  const columns: DataTableColumn<RiderRecord>[] = [
    {
      id: "name",
      header: "Rider",
      sortable: true,
      hideOnCard: true,
      cell: (row) => (
        <span className="flex min-w-0 items-center gap-2.5">
          <Avatar name={row.name} className="h-8 w-8 shrink-0" />
          <span className="min-w-0">
            <span className="block truncate font-bold text-brand-navy-deep ">{row.name}</span>
            <span className="block truncate text-xs text-brand-muted">{plainText(row.phone)}</span>
          </span>
        </span>
      ),
    },
    { id: "vehicle", header: "Vehicle", cell: (row) => plainText(row.vehicle) },
    { id: "zone", header: "Zone", sortable: true, cell: (row) => plainText(row.zone) },
    {
      id: "activeOrders",
      header: "Active",
      sortable: true,
      align: "end",
      cell: (row) => row.activeOrders,
    },
    { id: "completedToday", header: "Done today", align: "end", cell: (row) => row.completedToday },
    { id: "rating", header: "Rating", align: "end", cell: (row) => plainText(row.rating) },
    { id: "status", header: "Status", cell: (row) => <StatusBadge status={row.status} /> },
  ];

  const actions: RowAction<RiderRecord>[] = [
    {
      id: "edit",
      label: "Edit rider",
      onSelect: (row) => {
        setEditing(row);
        setFormOpen(true);
      },
      hidden: () => !can("riders", "edit"),
    },
    {
      id: "remove",
      label: "Remove rider",
      tone: "danger",
      onSelect: (row) => setRemoving(row),
      hidden: () => !can("riders", "delete"),
    },
  ];

  return (
    <>
    <CollectionPage<RiderRecord>
      title="Riders"
      description={DESCRIPTION}
      collection={collection}
      columns={columns}
      rowKey={(row) => row.id}
      cardTitle={(row) => row.name}
      actions={actions}
      searchLabel="Search riders"
      searchPlaceholder="Search by rider or zone"
      empty={<PresetEmpty preset="riders" />}
      headerAction={
        can("riders", "create") ? (
          <OwnerButton
            className="px-3 py-2 text-xs"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Add rider
          </OwnerButton>
        ) : null
      }
      filters={
        <SelectFilter
          label="Status"
          value={filterValue(collection.filters, "status")}
          options={RIDER_STATUS_OPTIONS}
          onChange={(value) => collection.setFilter("status", value)}
          allLabel="All riders"
        />
      }
    />

      <RiderFormDialog
        open={formOpen}
        rider={editing}
        onClose={() => setFormOpen(false)}
        onSubmit={async (values, id) => {
          await upsertRider(values, id);
          ownerToast.success(`${values.name} saved`);
        }}
      />

      <ConfirmDialog
        open={removing !== null}
        title="Remove rider"
        message={`${removing?.name ?? ""} will be unassigned from any active orders.`}
        confirmLabel="Remove rider"
        tone="danger"
        loading={deleting}
        onCancel={() => setRemoving(null)}
        onConfirm={async () => {
          if (!removing) return;
          setDeleting(true);
          await deleteRider(removing.id);
          setDeleting(false);
          ownerToast.success(`${removing.name} removed`);
          setRemoving(null);
        }}
      />
    </>
  );
}

export default OwnerRidersPage;
