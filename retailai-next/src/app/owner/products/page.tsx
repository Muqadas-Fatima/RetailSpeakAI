"use client";

import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { CollectionPage } from "@/components/owner/collection-page";
import { ConfirmDialog, OwnerButton } from "@/components/owner/confirm-dialog";
import type { DataTableColumn, RowAction } from "@/components/owner/data-table";
import { SelectFilter, type FilterOption } from "@/components/owner/filters";
import { Avatar } from "@/components/owner/primitives";
import { PresetEmpty } from "@/components/owner/states";
import { StatusBadge } from "@/components/owner/status-badge";
import { ProductFormDialog } from "@/components/owner/record-dialogs";
import { useAccess } from "@/lib/owner/access";
import { filterValue, useOwnerCollection } from "@/lib/owner/collection";
import { plainText, quantityLabel } from "@/lib/owner/format";
import {
  PRODUCT_STATUS_OPTIONS,
  type OwnerProduct,
  deleteProduct,
  fetchProductCategories,
  fetchProducts,
  upsertProduct,
} from "@/lib/owner/records";
import { ownerToast, ownerToastMessages } from "@/lib/owner/toast";

const DESCRIPTION = "Catalog items, pricing and availability across your business.";



function OwnerProductsPage() {
  const { can } = useAccess();
  const collection = useOwnerCollection<OwnerProduct>(fetchProducts, {
    initialSort: { columnId: "name", direction: "asc" },
  });
  const [categories, setCategories] = useState<FilterOption[]>([]);
  const [editing, setEditing] = useState<OwnerProduct | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [removing, setRemoving] = useState<OwnerProduct | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetchProductCategories().then((options) => {
      if (!cancelled) setCategories(options);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const columns: DataTableColumn<OwnerProduct>[] = [
    {
      id: "name",
      header: "Product",
      sortable: true,
      hideOnCard: true,
      cell: (row) => (
        <span className="flex min-w-0 items-center gap-2.5">
          <Avatar name={row.name} src={row.imageUrl ?? undefined} className="h-8 w-8 shrink-0" />
          <span className="min-w-0">
            <span className="block truncate font-bold text-brand-navy-deep ">{row.name}</span>
            <span className="block truncate text-xs text-brand-muted">{plainText(row.sku)}</span>
          </span>
        </span>
      ),
    },
    { id: "category", header: "Category", sortable: true, cell: (row) => plainText(row.category) },
    {
      id: "price",
      header: "Price",
      sortable: true,
      align: "end",
      cell: (row) => (
        <span className="font-bold text-brand-navy-deep ">{plainText(row.price)}</span>
      ),
    },
    {
      id: "stock",
      header: "Stock",
      sortable: true,
      align: "end",
      cell: (row) => quantityLabel(row.stock, row.unit),
    },
    { id: "status", header: "Status", cell: (row) => <StatusBadge status={row.status} /> },
  ];

  const actions: RowAction<OwnerProduct>[] = [
    {
      id: "edit",
      label: "Edit product",
      onSelect: (row) => {
        setEditing(row);
        setFormOpen(true);
      },
      hidden: () => !can("products", "edit"),
    },
    {
      id: "delete",
      label: "Delete product",
      tone: "danger",
      onSelect: (row) => setRemoving(row),
      hidden: () => !can("products", "delete"),
    },
  ];

  return (
    <>
    <CollectionPage<OwnerProduct>
      title="Products"
      description={DESCRIPTION}
      collection={collection}
      columns={columns}
      rowKey={(row) => row.id}
      cardTitle={(row) => row.name}
      actions={actions}
      searchLabel="Search products"
      searchPlaceholder="Search by name or SKU"
      empty={<PresetEmpty preset="products" />}
      headerAction={
        can("products", "create") ? (
          <OwnerButton
            className="px-3 py-2 text-xs"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Add product
          </OwnerButton>
        ) : null
      }
      filters={
        <>
          <SelectFilter
            label="Category"
            value={filterValue(collection.filters, "category")}
            options={categories}
            onChange={(value) => collection.setFilter("category", value)}
            allLabel="All categories"
          />
          <SelectFilter
            label="Status"
            value={filterValue(collection.filters, "status")}
            options={PRODUCT_STATUS_OPTIONS}
            onChange={(value) => collection.setFilter("status", value)}
            allLabel="All statuses"
          />
        </>
      }
    />

      <ProductFormDialog
        open={formOpen}
        product={editing}
        categories={categories}
        onClose={() => setFormOpen(false)}
        onSubmit={async (values, id) => {
          await upsertProduct(values, id);
          ownerToast.success(ownerToastMessages.productUpdated(values.name));
        }}
      />

      <ConfirmDialog
        open={removing !== null}
        title="Delete product"
        message={`${removing?.name ?? ""} will be removed from the catalog and inventory.`}
        confirmLabel="Delete product"
        tone="danger"
        loading={deleting}
        onCancel={() => setRemoving(null)}
        onConfirm={async () => {
          if (!removing) return;
          setDeleting(true);
          await deleteProduct(removing.id);
          setDeleting(false);
          ownerToast.success(ownerToastMessages.productDeleted(removing.name));
          setRemoving(null);
        }}
      />
    </>
  );
}

export default OwnerProductsPage;
