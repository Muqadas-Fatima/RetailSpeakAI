"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { CollectionPage } from "@/components/owner/collection-page";
import { ConfirmDialog, OwnerButton } from "@/components/owner/confirm-dialog";
import type { DataTableColumn, RowAction } from "@/components/owner/data-table";
import { SelectFilter } from "@/components/owner/filters";
import { PresetEmpty } from "@/components/owner/states";
import { StatusBadge } from "@/components/owner/status-badge";
import { SupplierFormDialog } from "@/components/owner/record-dialogs";
import { useAccess } from "@/lib/owner/access";
import { filterValue, useOwnerCollection } from "@/lib/owner/collection";
import { plainText } from "@/lib/owner/format";
import {
  SUPPLIER_STATUS_OPTIONS,
  type SupplierRecord,
  deleteSupplier,
  fetchSuppliers,
  upsertSupplier,
} from "@/lib/owner/records";
import { ownerToast, ownerToastMessages } from "@/lib/owner/toast";

const DESCRIPTION = "Supplier directory with contacts, terms and outstanding balances.";



function OwnerSuppliersPage() {
  const { can } = useAccess();
  const collection = useOwnerCollection<SupplierRecord>(fetchSuppliers, {
    initialSort: { columnId: "name", direction: "asc" },
  });
  const [editing, setEditing] = useState<SupplierRecord | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [removing, setRemoving] = useState<SupplierRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  const columns: DataTableColumn<SupplierRecord>[] = [
    {
      id: "name",
      header: "Supplier",
      sortable: true,
      hideOnCard: true,
      cell: (row) => (
        <span className="min-w-0">
          <span className="block truncate font-bold text-brand-navy-deep ">{row.name}</span>
          <span className="block truncate text-xs text-brand-muted">
            {plainText(row.contactName)}
          </span>
        </span>
      ),
    },
    { id: "phone", header: "Phone", cell: (row) => plainText(row.phone) },
    { id: "category", header: "Supplies", sortable: true, cell: (row) => plainText(row.category) },
    { id: "paymentTerms", header: "Terms", cell: (row) => plainText(row.paymentTerms) },
    {
      id: "outstanding",
      header: "Outstanding",
      sortable: true,
      align: "end",
      cell: (row) => (
        <span className="font-bold text-brand-navy-deep ">{plainText(row.outstanding)}</span>
      ),
    },
    { id: "status", header: "Status", cell: (row) => <StatusBadge status={row.status} /> },
  ];

  const actions: RowAction<SupplierRecord>[] = [
    {
      id: "edit",
      label: "Edit supplier",
      onSelect: (row) => {
        setEditing(row);
        setFormOpen(true);
      },
      hidden: () => !can("suppliers", "edit"),
    },
    {
      id: "delete",
      label: "Remove supplier",
      tone: "danger",
      onSelect: (row) => setRemoving(row),
      hidden: () => !can("suppliers", "delete"),
    },
  ];

  return (
    <>
    <CollectionPage<SupplierRecord>
      title="Suppliers"
      description={DESCRIPTION}
      collection={collection}
      columns={columns}
      rowKey={(row) => row.id}
      cardTitle={(row) => row.name}
      actions={actions}
      searchLabel="Search suppliers"
      searchPlaceholder="Search by supplier or contact"
      empty={<PresetEmpty preset="suppliers" />}
      headerAction={
        can("suppliers", "create") ? (
          <OwnerButton
            className="px-3 py-2 text-xs"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Add supplier
          </OwnerButton>
        ) : null
      }
      filters={
        <SelectFilter
          label="Status"
          value={filterValue(collection.filters, "status")}
          options={SUPPLIER_STATUS_OPTIONS}
          onChange={(value) => collection.setFilter("status", value)}
          allLabel="All statuses"
        />
      }
    />

      <SupplierFormDialog
        open={formOpen}
        supplier={editing}
        onClose={() => setFormOpen(false)}
        onSubmit={async (values, id) => {
          await upsertSupplier(values, id);
          ownerToast.success(ownerToastMessages.supplierAdded(values.name));
        }}
      />

      <ConfirmDialog
        open={removing !== null}
        title="Remove supplier"
        message={`${removing?.name ?? ""} will no longer be available for purchase orders.`}
        confirmLabel="Remove supplier"
        tone="danger"
        loading={deleting}
        onCancel={() => setRemoving(null)}
        onConfirm={async () => {
          if (!removing) return;
          setDeleting(true);
          await deleteSupplier(removing.id);
          setDeleting(false);
          ownerToast.success(`${removing.name} removed`);
          setRemoving(null);
        }}
      />
    </>
  );
}

export default OwnerSuppliersPage;
