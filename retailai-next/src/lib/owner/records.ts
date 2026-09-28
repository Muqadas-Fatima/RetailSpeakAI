"use client";
/**
 * Owner Portal record layer.
 *
 * Every management collection (orders, products, inventory, suppliers, purchase
 * orders, khata, riders, voice sessions, forecast rows, imports) is described
 * here as a DTO plus a repository function. The repositories are the ONLY place
 * that knows where data comes from: today they read mock JSON datasets from
 * `src/data/owner/*.json` through the local query engine, tomorrow each body
 * becomes a `fetch` / server function call and no screen changes.
 *
 * No business data is written inline here — every row lives in a JSON file.
 */
import type { FilterOption } from "@/components/owner/filters";
import forecastRowsData from "@/data/owner/forecast-rows.json";
import khataData from "@/data/owner/khata.json";
import productsData from "@/data/owner/products.json";
import voiceSessionsData from "@/data/owner/voice-sessions.json";
import { delay, mockCollection, mockMutation, mockRecord, runQuery } from "./mock-query";
import {
  type ProductInput,
  type PurchaseOrderInput,
  type RiderInput,
  type SupplierInput,
  adjustInventory,
  applyKhataPayment,
  assignRiderToOrder,
  createPurchaseOrder,
  deleteProduct as removeProduct,
  deleteRider as removeRider,
  deleteSupplier as removeSupplier,
  ownerState,
  recordImportBatch,
  saveProduct,
  saveRider,
  saveSupplier,
  setPurchaseOrderStatus,
  updateOrderStatus,
} from "./store";

/**
 * Builds a repository bound to a live slice of the centralized owner store, so
 * every mutation made anywhere in the portal is reflected on every screen.
 */
function storeCollection<Row>(
  select: () => readonly Row[],
  options: { searchFields?: string[] } = {},
): CollectionFetcher<Row> {
  return (query) => delay(runQuery(select(), query, options));
}

/* ------------------------------- Query model ------------------------------ */

export type CollectionSort = { columnId: string; direction: "asc" | "desc" };

/** Query envelope sent to a repository — maps 1:1 onto API query params. */
export type CollectionQuery = {
  page: number;
  pageSize: number;
  search: string;
  /** Arbitrary `field -> value` filters; empty string means "all". */
  filters: Record<string, string>;
  sort: CollectionSort | null;
};

/** Paged response envelope returned by every repository. */
export type CollectionPage<Row> = {
  rows: Row[];
  /** Total matching rows across all pages, as reported by the API. */
  total: number;
};

export type CollectionFetcher<Row> = (query: CollectionQuery) => Promise<CollectionPage<Row>>;

/* --------------------------------- Orders -------------------------------- */

export type OrderChannel = "voice" | "chat" | "app" | "counter";

export type OwnerOrder = {
  id: string;
  reference: string;
  customerName: string;
  channel: OrderChannel;
  itemCount: number;
  /** Preformatted by the API so currency stays a backend concern. */
  total: string;
  status: string;
  placedAt: string;
  riderName: string | null;
};

export const ORDER_STATUS_OPTIONS: FilterOption[] = [
  { value: "new", label: "New" },
  { value: "accepted", label: "Accepted" },
  { value: "preparing", label: "Preparing" },
  { value: "ready", label: "Ready" },
  { value: "dispatched", label: "Dispatched" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
];

export const ORDER_CHANNEL_OPTIONS: FilterOption[] = [
  { value: "voice", label: "Voice" },
  { value: "chat", label: "Chat" },
  { value: "app", label: "App" },
  { value: "counter", label: "Counter" },
];

export const fetchOrders = storeCollection<OwnerOrder>(() => ownerState().orders, {
  searchFields: ["reference", "customerName", "riderName", "status", "channel"],
});

/** Order workflow mutations (frontend-only, centralized state). */
export async function setOrderStatus(input: { id: string; status: string }) {
  updateOrderStatus(input.id, input.status);
  return delay({ ok: true as const }, 260);
}

export async function assignOrderRider(input: { id: string; riderName: string | null }) {
  assignRiderToOrder(input.id, input.riderName);
  return delay({ ok: true as const }, 260);
}

/* -------------------------------- Products ------------------------------- */

export type OwnerProduct = {
  id: string;
  name: string;
  sku: string;
  category: string;
  price: string;
  stock: number;
  unit: string;
  status: string;
  imageUrl: string | null;
};

export const PRODUCT_STATUS_OPTIONS: FilterOption[] = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "out_of_stock", label: "Out of Stock" },
];

export const fetchProducts = storeCollection<OwnerProduct>(() => ownerState().products, {
  searchFields: ["name", "sku", "category", "status"],
});

export async function upsertProduct(input: ProductInput, id?: string) {
  const product = saveProduct(input, id);
  return delay(product, 320);
}

export async function deleteProduct(id: string) {
  removeProduct(id);
  return delay({ ok: true as const }, 260);
}
/** Categories are business data, so they come from the API, never a constant. */
export const fetchProductCategories: () => Promise<FilterOption[]> = () =>
  delay(productsData.categories as FilterOption[]);

/* ------------------------------- Inventory ------------------------------- */

export type InventoryRecord = {
  id: string;
  productName: string;
  sku: string;
  category: string;
  onHand: number;
  unit: string;
  reorderLevel: number;
  status: string;
  updatedAt: string;
};

export const STOCK_STATUS_OPTIONS: FilterOption[] = [
  { value: "in_stock", label: "In Stock" },
  { value: "low", label: "Low" },
  { value: "critical", label: "Critical" },
  { value: "out_of_stock", label: "Out of Stock" },
];

export const fetchInventory = storeCollection<InventoryRecord>(() => ownerState().inventory, {
  searchFields: ["productName", "sku", "category", "status"],
});

export async function adjustStock(input: { id: string; onHand: number; reorderLevel: number }) {
  adjustInventory(input.id, input.onHand, input.reorderLevel);
  return delay({ ok: true as const }, 300);
}

/* -------------------------------- Suppliers ------------------------------ */

export type SupplierRecord = {
  id: string;
  name: string;
  contactName: string | null;
  phone: string | null;
  category: string;
  paymentTerms: string;
  outstanding: string;
  status: string;
};

export const SUPPLIER_STATUS_OPTIONS: FilterOption[] = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

export const fetchSuppliers = storeCollection<SupplierRecord>(() => ownerState().suppliers, {
  searchFields: ["name", "contactName", "phone", "category", "paymentTerms"],
});

/** Supplier options for pickers (purchase orders, imports). */
export const fetchSupplierOptions: () => Promise<FilterOption[]> = () =>
  delay(
    ownerState()
      .suppliers.filter((supplier) => supplier.status === "active")
      .map((supplier) => ({ value: supplier.name, label: supplier.name })),
  );

export async function upsertSupplier(input: SupplierInput, id?: string) {
  const supplier = saveSupplier(input, id);
  return delay(supplier, 320);
}

export async function deleteSupplier(id: string) {
  removeSupplier(id);
  return delay({ ok: true as const }, 260);
}

/* ----------------------------- Purchase orders --------------------------- */

export type PurchaseOrderRecord = {
  id: string;
  reference: string;
  supplierName: string;
  itemCount: number;
  total: string;
  status: string;
  createdAt: string;
  expectedAt: string | null;
};

export const PO_STATUS_OPTIONS: FilterOption[] = [
  { value: "draft", label: "Draft" },
  { value: "awaiting_approval", label: "Awaiting Approval" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "partially_received", label: "Partially Received" },
  { value: "received", label: "Received" },
];

export const fetchPurchaseOrders = storeCollection<PurchaseOrderRecord>(
  () => ownerState().purchaseOrders,
  { searchFields: ["reference", "supplierName", "status"] },
);

export async function approvePurchaseOrder(input: { id: string; note: string }) {
  setPurchaseOrderStatus(input.id, "approved");
  return delay({ ok: true as const }, 320);
}

export async function rejectPurchaseOrder(input: { id: string; reason: string }) {
  setPurchaseOrderStatus(input.id, "rejected");
  return delay({ ok: true as const }, 320);
}

export async function raisePurchaseOrder(input: PurchaseOrderInput) {
  const record = createPurchaseOrder(input);
  return delay(record, 360);
}

/* -------------------------------- Khata ---------------------------------- */

export type KhataAccount = {
  id: string;
  supplierName: string;
  outstanding: string;
  lastPaymentAt: string | null;
  dueAt: string | null;
  status: string;
};

export type KhataDetail = {
  id: string;
  supplierName: string;
  phone: string | null;
  paymentTerms: string;
  creditLimit: string;
  outstanding: string;
  lastPaymentAt: string | null;
  status: string;
};

export type KhataEntryType = "purchase" | "payment" | "adjustment";

export type KhataEntry = {
  id: string;
  occurredAt: string;
  type: KhataEntryType;
  reference: string;
  /** Preformatted amounts; exactly one of debit/credit is set. */
  debit: string | null;
  credit: string | null;
  balance: string;
  note: string | null;
};

export const KHATA_STATUS_OPTIONS: FilterOption[] = [
  { value: "settled", label: "Settled" },
  { value: "due_soon", label: "Due Soon" },
  { value: "overdue", label: "Overdue" },
];

export const KHATA_ENTRY_TYPE_OPTIONS: FilterOption[] = [
  { value: "purchase", label: "Purchase" },
  { value: "payment", label: "Payment" },
  { value: "adjustment", label: "Adjustment" },
];

export const PAYMENT_METHOD_OPTIONS: FilterOption[] = [
  { value: "cash", label: "Cash" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "cheque", label: "Cheque" },
  { value: "wallet", label: "Mobile Wallet" },
];

export const fetchKhataAccounts = storeCollection<KhataAccount>(
  () => ownerState().khataAccounts,
  { searchFields: ["supplierName", "status"] },
);

/** Ledger entries are scoped by `filters.accountId`, exactly like the future API. */
export const fetchKhataEntries: CollectionFetcher<KhataEntry> = (query) => {
  const accountId = query.filters["accountId"] ?? "";
  const ledgers = ownerState().khataEntries;
  const rows = accountId ? (ledgers[accountId] ?? []) : Object.values(ledgers).flat();
  const { accountId: _scoped, ...filters } = query.filters;
  return mockCollection<KhataEntry>(rows, {
    searchFields: ["reference", "note", "type"],
  })({ ...query, filters });
};

export const fetchKhataDetail = mockRecord<KhataDetail>((id) => {
  const detail = (khataData.details as Record<string, KhataDetail>)[id];
  if (!detail) return undefined;
  const account = ownerState().khataAccounts.find((row) => row.id === id);
  return account
    ? {
        ...detail,
        outstanding: account.outstanding,
        lastPaymentAt: account.lastPaymentAt,
        status: account.status,
      }
    : detail;
});
export async function recordKhataPayment(input: {
  accountId: string;
  amount: string;
  method: string;
  paidOn: string;
  reference: string;
  note: string;
}) {
  applyKhataPayment(input);
  return delay({ ok: true as const }, 340);
}

/* --------------------------------- Riders -------------------------------- */

export type RiderRecord = {
  id: string;
  name: string;
  phone: string | null;
  vehicle: string;
  zone: string;
  activeOrders: number;
  completedToday: number;
  status: string;
  rating: string | null;
};

export const RIDER_STATUS_OPTIONS: FilterOption[] = [
  { value: "available", label: "Available" },
  { value: "on_delivery", label: "On Delivery" },
  { value: "offline", label: "Offline" },
  { value: "inactive", label: "Inactive" },
];

export const fetchRiders = storeCollection<RiderRecord>(() => ownerState().riders, {
  searchFields: ["name", "phone", "vehicle", "zone", "status"],
});

/** Rider options for order assignment — only riders who can take a delivery. */
export const fetchAvailableRiders: () => Promise<FilterOption[]> = () =>
  delay(
    ownerState()
      .riders.filter((rider) => rider.status === "available" || rider.status === "on_delivery")
      .map((rider) => ({
        value: rider.name,
        label: `${rider.name} — ${rider.zone} (${rider.activeOrders} active)`,
      })),
  );

export async function upsertRider(input: RiderInput, id?: string) {
  const rider = saveRider(input, id);
  return delay(rider, 320);
}

export async function deleteRider(id: string) {
  removeRider(id);
  return delay({ ok: true as const }, 260);
}

/* ---------------------------- Voice ordering log ------------------------- */

export type VoiceSessionRecord = {
  id: string;
  startedAt: string;
  language: string;
  transcript: string;
  detectedIntent: string;
  outcome: string;
  orderReference: string | null;
  durationLabel: string;
};

export const VOICE_OUTCOME_OPTIONS: FilterOption[] = [
  { value: "order_placed", label: "Order Placed" },
  { value: "abandoned", label: "Abandoned" },
  { value: "not_understood", label: "Not Understood" },
  { value: "handed_off", label: "Handed to Agent" },
];

export const fetchVoiceSessions = mockCollection<VoiceSessionRecord>(
  voiceSessionsData as VoiceSessionRecord[],
  { searchFields: ["transcript", "detectedIntent", "language", "orderReference"] },
);

/* -------------------------------- Forecast ------------------------------- */

export type ForecastRow = {
  id: string;
  productName: string;
  category: string;
  currentStock: number;
  predictedDemand: number;
  suggestedReorder: number;
  confidence: string;
  riskStatus: string;
};

export const FORECAST_RISK_OPTIONS: FilterOption[] = [
  { value: "critical", label: "Critical" },
  { value: "low", label: "Low" },
  { value: "in_stock", label: "Healthy" },
];

export const fetchForecastRows = mockCollection<ForecastRow>(forecastRowsData as ForecastRow[], {
  searchFields: ["productName", "category", "riskStatus"],
});

/* --------------------------------- Imports ------------------------------- */

export type ImportBatch = {
  id: string;
  fileName: string;
  entity: string;
  rowCount: number;
  status: string;
  uploadedAt: string;
  message: string | null;
};

/** Import targets the dashboard supports. Config, not business data. */
export const IMPORT_ENTITY_OPTIONS: FilterOption[] = [
  { value: "products", label: "Products" },
  { value: "inventory", label: "Inventory" },
  { value: "suppliers", label: "Suppliers" },
  { value: "purchase-orders", label: "Purchase Orders" },
];

export const fetchImportBatches = storeCollection<ImportBatch>(
  () => ownerState().importBatches,
  { searchFields: ["fileName", "entity", "status", "message"] },
);

export async function submitImport(input: {
  entity: string;
  fileName: string;
  fileSize: number;
  rowCount: number;
}) {
  const batch = recordImportBatch({
    entity: input.entity,
    fileName: input.fileName,
    rowCount: input.rowCount,
  });
  return delay(batch, 400);
}
