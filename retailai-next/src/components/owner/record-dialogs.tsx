"use client";
/**
 * Create / edit / status dialogs for the owner record modules.
 *
 * These are presentation + local form state only. Each dialog receives the
 * record and an async submit handler, so the same component works for any
 * business type and no business data is hardcoded here.
 */
import { AlertTriangle } from "lucide-react";
import { useEffect, useState } from "react";
import { FormField } from "@/components/owner/account-widgets";
import { OwnerButton, OwnerModal } from "@/components/owner/confirm-dialog";
import type { FilterOption } from "@/components/owner/filters";
import { FilterOptionSelect } from "@/components/owner/select-field";
import {
  ORDER_STATUS_OPTIONS,
  PRODUCT_STATUS_OPTIONS,
  RIDER_STATUS_OPTIONS,
  SUPPLIER_STATUS_OPTIONS,
  type InventoryRecord,
  type OwnerOrder,
  type OwnerProduct,
  type RiderRecord,
  type SupplierRecord,
} from "@/lib/owner/records";

function DialogError({ message }: { message: string }) {
  return (
    <p
      role="alert"
      className="flex items-start gap-2 rounded-xl bg-brand-danger/10 px-3 py-2.5 text-xs font-semibold text-brand-danger"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      {message}
    </p>
  );
}

function useSubmit(open: boolean) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setLoading(false);
      setError(null);
    }
  }, [open]);

  const run = async (action: () => Promise<unknown>, onDone: () => void) => {
    setLoading(true);
    setError(null);
    try {
      await action();
      setLoading(false);
      onDone();
    } catch (cause) {
      setLoading(false);
      setError(cause instanceof Error ? cause.message : "Request failed");
    }
  };

  return { loading, error, setError, run };
}

function FormFooter({
  onClose,
  onSubmit,
  loading,
  submitLabel,
}: {
  onClose: () => void;
  onSubmit: () => void;
  loading: boolean;
  submitLabel: string;
}) {
  return (
    <>
      <OwnerButton variant="secondary" onClick={onClose}>
        Cancel
      </OwnerButton>
      <OwnerButton loading={loading} onClick={onSubmit}>
        {submitLabel}
      </OwnerButton>
    </>
  );
}

/* -------------------------------- Products ------------------------------- */

export type ProductFormValues = {
  name: string;
  sku: string;
  category: string;
  price: string;
  stock: number;
  unit: string;
  status: string;
};

export function ProductFormDialog({
  open,
  product,
  categories,
  onClose,
  onSubmit,
}: {
  open: boolean;
  product: OwnerProduct | null;
  categories: FilterOption[];
  onClose: () => void;
  onSubmit: (values: ProductFormValues, id?: string) => Promise<unknown>;
}) {
  const submit = useSubmit(open);
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [category, setCategory] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("0");
  const [unit, setUnit] = useState("");
  const [status, setStatus] = useState("active");

  useEffect(() => {
    if (!open) return;
    setName(product?.name ?? "");
    setSku(product?.sku ?? "");
    setCategory(product?.category ?? (categories[0]?.value ?? ""));
    setPrice(product?.price ?? "");
    setStock(String(product?.stock ?? 0));
    setUnit(product?.unit ?? "pcs");
    setStatus(product?.status ?? "active");
  }, [open, product, categories]);

  const handleSubmit = () => {
    if (!name.trim() || !sku.trim()) {
      submit.setError("Product name and SKU are required.");
      return;
    }
    void submit.run(
      () =>
        onSubmit(
          {
            name,
            sku,
            category,
            price,
            stock: Number(stock) || 0,
            unit,
            status,
          },
          product?.id,
        ),
      onClose,
    );
  };

  return (
    <OwnerModal
      open={open}
      onClose={onClose}
      title={product ? "Edit product" : "Add product"}
      description="Catalog details are shared with Inventory, so stock stays in sync."
      footer={
        <FormFooter
          onClose={onClose}
          onSubmit={handleSubmit}
          loading={submit.loading}
          submitLabel={product ? "Save changes" : "Add product"}
        />
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="product-name" label="Product name" value={name} onChange={setName} />
        <FormField id="product-sku" label="SKU" value={sku} onChange={setSku} />
        <FilterOptionSelect
          id="product-category"
          label="Category"
          value={category}
          options={categories}
          onChange={setCategory}
        />
        <FormField id="product-price" label="Price" value={price} onChange={setPrice} />
        <FormField
          id="product-stock"
          label="Stock"
          type="number"
          value={stock}
          onChange={setStock}
        />
        <FormField id="product-unit" label="Unit" value={unit} onChange={setUnit} />
        <FilterOptionSelect
          id="product-status"
          label="Status"
          value={status}
          options={PRODUCT_STATUS_OPTIONS}
          onChange={setStatus}
        />
      </div>
      {submit.error ? (
        <div className="mt-4">
          <DialogError message={submit.error} />
        </div>
      ) : null}
    </OwnerModal>
  );
}

/* -------------------------------- Inventory ------------------------------ */

export function AdjustStockDialog({
  open,
  record,
  onClose,
  onSubmit,
}: {
  open: boolean;
  record: InventoryRecord | null;
  onClose: () => void;
  onSubmit: (input: { id: string; onHand: number; reorderLevel: number }) => Promise<unknown>;
}) {
  const submit = useSubmit(open);
  const [onHand, setOnHand] = useState("0");
  const [reorderLevel, setReorderLevel] = useState("0");

  useEffect(() => {
    if (!open || !record) return;
    setOnHand(String(record.onHand));
    setReorderLevel(String(record.reorderLevel));
  }, [open, record]);

  if (!record) return null;

  return (
    <OwnerModal
      open={open}
      onClose={onClose}
      title="Adjust stock"
      description={`${record.productName} · ${record.sku}`}
      size="sm"
      footer={
        <FormFooter
          onClose={onClose}
          onSubmit={() =>
            void submit.run(
              () =>
                onSubmit({
                  id: record.id,
                  onHand: Number(onHand) || 0,
                  reorderLevel: Number(reorderLevel) || 0,
                }),
              onClose,
            )
          }
          loading={submit.loading}
          submitLabel="Save stock"
        />
      }
    >
      <div className="space-y-4">
        <FormField
          id="stock-on-hand"
          label={`On hand (${record.unit})`}
          type="number"
          value={onHand}
          onChange={setOnHand}
        />
        <FormField
          id="stock-reorder"
          label="Reorder level"
          type="number"
          value={reorderLevel}
          onChange={setReorderLevel}
        />
        {submit.error ? <DialogError message={submit.error} /> : null}
      </div>
    </OwnerModal>
  );
}

/* -------------------------------- Suppliers ------------------------------ */

export type SupplierFormValues = {
  name: string;
  contactName: string;
  phone: string;
  category: string;
  paymentTerms: string;
  status: string;
};

export function SupplierFormDialog({
  open,
  supplier,
  onClose,
  onSubmit,
}: {
  open: boolean;
  supplier: SupplierRecord | null;
  onClose: () => void;
  onSubmit: (values: SupplierFormValues, id?: string) => Promise<unknown>;
}) {
  const submit = useSubmit(open);
  const [name, setName] = useState("");
  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [category, setCategory] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [status, setStatus] = useState("active");

  useEffect(() => {
    if (!open) return;
    setName(supplier?.name ?? "");
    setContactName(supplier?.contactName ?? "");
    setPhone(supplier?.phone ?? "");
    setCategory(supplier?.category ?? "");
    setPaymentTerms(supplier?.paymentTerms ?? "");
    setStatus(supplier?.status ?? "active");
  }, [open, supplier]);

  const handleSubmit = () => {
    if (!name.trim()) {
      submit.setError("Supplier name is required.");
      return;
    }
    void submit.run(
      () =>
        onSubmit({ name, contactName, phone, category, paymentTerms, status }, supplier?.id),
      onClose,
    );
  };

  return (
    <OwnerModal
      open={open}
      onClose={onClose}
      title={supplier ? "Edit supplier" : "Add supplier"}
      description="Suppliers are shared with Purchase Orders and Khata."
      footer={
        <FormFooter
          onClose={onClose}
          onSubmit={handleSubmit}
          loading={submit.loading}
          submitLabel={supplier ? "Save changes" : "Add supplier"}
        />
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="supplier-name" label="Supplier name" value={name} onChange={setName} />
        <FormField
          id="supplier-contact"
          label="Contact person"
          value={contactName}
          onChange={setContactName}
        />
        <FormField id="supplier-phone" label="Phone" value={phone} onChange={setPhone} />
        <FormField id="supplier-category" label="Supplies" value={category} onChange={setCategory} />
        <FormField
          id="supplier-terms"
          label="Payment terms"
          value={paymentTerms}
          onChange={setPaymentTerms}
        />
        <FilterOptionSelect
          id="supplier-status"
          label="Status"
          value={status}
          options={SUPPLIER_STATUS_OPTIONS}
          onChange={setStatus}
        />
      </div>
      {submit.error ? (
        <div className="mt-4">
          <DialogError message={submit.error} />
        </div>
      ) : null}
    </OwnerModal>
  );
}

/* --------------------------------- Riders -------------------------------- */

export type RiderFormValues = {
  name: string;
  phone: string;
  vehicle: string;
  zone: string;
  status: string;
};

export function RiderFormDialog({
  open,
  rider,
  onClose,
  onSubmit,
}: {
  open: boolean;
  rider: RiderRecord | null;
  onClose: () => void;
  onSubmit: (values: RiderFormValues, id?: string) => Promise<unknown>;
}) {
  const submit = useSubmit(open);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [zone, setZone] = useState("");
  const [status, setStatus] = useState("available");

  useEffect(() => {
    if (!open) return;
    setName(rider?.name ?? "");
    setPhone(rider?.phone ?? "");
    setVehicle(rider?.vehicle ?? "");
    setZone(rider?.zone ?? "");
    setStatus(rider?.status ?? "available");
  }, [open, rider]);

  const handleSubmit = () => {
    if (!name.trim()) {
      submit.setError("Rider name is required.");
      return;
    }
    void submit.run(() => onSubmit({ name, phone, vehicle, zone, status }, rider?.id), onClose);
  };

  return (
    <OwnerModal
      open={open}
      onClose={onClose}
      title={rider ? "Edit rider" : "Add rider"}
      description="Riders are shared with Orders for delivery assignment."
      footer={
        <FormFooter
          onClose={onClose}
          onSubmit={handleSubmit}
          loading={submit.loading}
          submitLabel={rider ? "Save changes" : "Add rider"}
        />
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="rider-name" label="Rider name" value={name} onChange={setName} />
        <FormField id="rider-phone" label="Phone" value={phone} onChange={setPhone} />
        <FormField id="rider-vehicle" label="Vehicle" value={vehicle} onChange={setVehicle} />
        <FormField id="rider-zone" label="Zone" value={zone} onChange={setZone} />
        <FilterOptionSelect
          id="rider-status"
          label="Availability"
          value={status}
          options={RIDER_STATUS_OPTIONS}
          onChange={setStatus}
        />
      </div>
      {submit.error ? (
        <div className="mt-4">
          <DialogError message={submit.error} />
        </div>
      ) : null}
    </OwnerModal>
  );
}

/* --------------------------------- Orders -------------------------------- */

export function OrderStatusDialog({
  open,
  order,
  onClose,
  onSubmit,
}: {
  open: boolean;
  order: OwnerOrder | null;
  onClose: () => void;
  onSubmit: (input: { id: string; status: string }) => Promise<unknown>;
}) {
  const submit = useSubmit(open);
  const [status, setStatus] = useState("new");

  useEffect(() => {
    if (open && order) setStatus(order.status);
  }, [open, order]);

  if (!order) return null;

  return (
    <OwnerModal
      open={open}
      onClose={onClose}
      title="Update order status"
      description={`${order.reference} · ${order.customerName}`}
      size="sm"
      footer={
        <FormFooter
          onClose={onClose}
          onSubmit={() => void submit.run(() => onSubmit({ id: order.id, status }), onClose)}
          loading={submit.loading}
          submitLabel="Update status"
        />
      }
    >
      <div className="space-y-4">
        <FilterOptionSelect
          id="order-status"
          label="Status"
          value={status}
          options={ORDER_STATUS_OPTIONS}
          onChange={setStatus}
        />
        {submit.error ? <DialogError message={submit.error} /> : null}
      </div>
    </OwnerModal>
  );
}

export function AssignRiderDialog({
  open,
  order,
  riders,
  onClose,
  onSubmit,
}: {
  open: boolean;
  order: OwnerOrder | null;
  riders: FilterOption[];
  onClose: () => void;
  onSubmit: (input: { id: string; riderName: string | null }) => Promise<unknown>;
}) {
  const submit = useSubmit(open);
  const [riderName, setRiderName] = useState("");

  useEffect(() => {
    if (open) setRiderName(order?.riderName ?? "");
  }, [open, order]);

  if (!order) return null;

  return (
    <OwnerModal
      open={open}
      onClose={onClose}
      title="Assign rider"
      description={`${order.reference} · ${order.customerName}`}
      size="sm"
      footer={
        <FormFooter
          onClose={onClose}
          onSubmit={() =>
            void submit.run(
              () => onSubmit({ id: order.id, riderName: riderName || null }),
              onClose,
            )
          }
          loading={submit.loading}
          submitLabel="Assign rider"
        />
      }
    >
      <div className="space-y-4">
        <FilterOptionSelect
          id="order-rider"
          label="Rider"
          value={riderName}
          options={riders}
          onChange={setRiderName}
          placeholder={riders.length === 0 ? "No riders available" : "Select a rider"}
        />
        {submit.error ? <DialogError message={submit.error} /> : null}
      </div>
    </OwnerModal>
  );
}

/* ----------------------------- Purchase orders --------------------------- */

export type PurchaseOrderFormValues = {
  supplierName: string;
  itemCount: number;
  total: string;
  expectedAt: string | null;
  status: string;
};

export function NewPurchaseOrderDialog({
  open,
  suppliers,
  onClose,
  onSubmit,
}: {
  open: boolean;
  suppliers: FilterOption[];
  onClose: () => void;
  onSubmit: (values: PurchaseOrderFormValues) => Promise<unknown>;
}) {
  const submit = useSubmit(open);
  const [supplierName, setSupplierName] = useState("");
  const [itemCount, setItemCount] = useState("1");
  const [total, setTotal] = useState("");
  const [expectedAt, setExpectedAt] = useState("");

  useEffect(() => {
    if (!open) return;
    setSupplierName(suppliers[0]?.value ?? "");
    setItemCount("1");
    setTotal("");
    setExpectedAt("");
  }, [open, suppliers]);

  const handleSubmit = () => {
    if (!supplierName) {
      submit.setError("Select a supplier for this purchase order.");
      return;
    }
    void submit.run(
      () =>
        onSubmit({
          supplierName,
          itemCount: Number(itemCount) || 1,
          total,
          expectedAt: expectedAt ? new Date(expectedAt).toISOString() : null,
          status: "awaiting_approval",
        }),
      onClose,
    );
  };

  return (
    <OwnerModal
      open={open}
      onClose={onClose}
      title="New purchase order"
      description="Raise a restock order for one of your active suppliers."
      footer={
        <FormFooter
          onClose={onClose}
          onSubmit={handleSubmit}
          loading={submit.loading}
          submitLabel="Create order"
        />
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <FilterOptionSelect
          id="po-supplier"
          label="Supplier"
          value={supplierName}
          options={suppliers}
          onChange={setSupplierName}
          placeholder={suppliers.length === 0 ? "No active suppliers" : "Select a supplier"}
        />
        <FormField
          id="po-items"
          label="Item lines"
          type="number"
          value={itemCount}
          onChange={setItemCount}
        />
        <FormField id="po-total" label="Order total" value={total} onChange={setTotal} />
        <FormField
          id="po-expected"
          label="Expected delivery"
          type="date"
          value={expectedAt}
          onChange={setExpectedAt}
        />
      </div>
      {submit.error ? (
        <div className="mt-4">
          <DialogError message={submit.error} />
        </div>
      ) : null}
    </OwnerModal>
  );
}
