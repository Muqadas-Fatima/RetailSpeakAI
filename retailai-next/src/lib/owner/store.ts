"use client";
/**
 * Centralized Owner Portal demo state.
 *
 * Every owner module (products, inventory, orders, riders, suppliers, purchase
 * orders, khata) reads and writes THIS store — there is no per-screen dataset.
 * Rows are seeded once from `src/data/owner/*.json`, kept in memory for the
 * session, and mirrored to localStorage so interactions survive a reload.
 *
 * Frontend only: no backend, no API, no database. When a real API exists, the
 * repositories in `records.ts` swap their bodies for requests and screens stay
 * exactly as they are.
 */
import importBatchesData from "@/data/owner/import-batches.json";
import inventoryData from "@/data/owner/inventory.json";
import khataData from "@/data/owner/khata.json";
import ordersData from "@/data/owner/orders.json";
import productsData from "@/data/owner/products.json";
import purchaseOrdersData from "@/data/owner/purchase-orders.json";
import ridersData from "@/data/owner/riders.json";
import suppliersData from "@/data/owner/suppliers.json";
import type {
  ImportBatch,
  InventoryRecord,
  KhataAccount,
  KhataEntry,
  OwnerOrder,
  OwnerProduct,
  PurchaseOrderRecord,
  RiderRecord,
  SupplierRecord,
} from "./records";

const STORAGE_KEY = "retailai.owner.demo-state.v1";

export type OwnerState = {
  products: OwnerProduct[];
  inventory: InventoryRecord[];
  orders: OwnerOrder[];
  riders: RiderRecord[];
  suppliers: SupplierRecord[];
  purchaseOrders: PurchaseOrderRecord[];
  khataAccounts: KhataAccount[];
  khataEntries: Record<string, KhataEntry[]>;
  importBatches: ImportBatch[];
};

function seed(): OwnerState {
  return structuredClone({
    products: productsData.rows as OwnerProduct[],
    inventory: inventoryData as InventoryRecord[],
    orders: ordersData as OwnerOrder[],
    riders: ridersData as RiderRecord[],
    suppliers: suppliersData as SupplierRecord[],
    purchaseOrders: purchaseOrdersData as PurchaseOrderRecord[],
    khataAccounts: khataData.accounts as KhataAccount[],
    khataEntries: khataData.entries as Record<string, KhataEntry[]>,
    importBatches: importBatchesData as ImportBatch[],
  });
}

let state: OwnerState = seed();
let hydrated = false;

const listeners = new Set<() => void>();

function persist() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable in this prototype */
  }
}

function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Partial<OwnerState>;
    state = { ...state, ...parsed };
  } catch {
    /* ignore malformed cache and keep the seed */
  }
}

/** Read the current centralized state (hydrating from storage on first use). */
export function ownerState(): OwnerState {
  hydrate();
  return state;
}

/** Subscribe to any mutation so open screens refetch themselves. */
export function subscribeOwnerState(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function commit(next: Partial<OwnerState>) {
  hydrate();
  state = { ...state, ...next };
  persist();
  listeners.forEach((listener) => listener());
}

/** Restore the pristine demo dataset (used by Settings → reset demo data). */
export function resetOwnerState() {
  state = seed();
  persist();
  listeners.forEach((listener) => listener());
}

/* ------------------------------ money helpers ----------------------------- */

/** "Rs 3,180" -> 3180. Currency stays a formatting concern only. */
export function parseMoney(value: string | null | undefined): number {
  if (!value) return 0;
  const numeric = Number(String(value).replace(/[^\d.-]/g, ""));
  return Number.isFinite(numeric) ? numeric : 0;
}

/** 3180 -> "Rs 3,180" using the prefix of the value it is derived from. */
export function formatMoney(amount: number, sample = "Rs 0"): string {
  const prefix = String(sample).replace(/[\d.,-]/g, "").trim() || "Rs";
  return `${prefix} ${Math.round(amount).toLocaleString("en-US")}`;
}

function newId(prefix: string): string {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${random}`;
}

/* --------------------------- products <-> inventory ----------------------- */

export function stockStatus(onHand: number, reorderLevel: number): string {
  if (onHand <= 0) return "out_of_stock";
  if (onHand <= Math.max(1, Math.round(reorderLevel * 0.4))) return "critical";
  if (onHand < reorderLevel) return "low";
  return "in_stock";
}

export type ProductInput = {
  name: string;
  sku: string;
  category: string;
  price: string;
  stock: number;
  unit: string;
  status: string;
};

/** Creates or updates a catalog product and mirrors it into inventory. */
export function saveProduct(input: ProductInput, id?: string): OwnerProduct {
  const current = ownerState();
  const now = new Date().toISOString();
  const existing = id ? current.products.find((row) => row.id === id) : undefined;

  const product: OwnerProduct = {
    id: existing?.id ?? newId("prd"),
    name: input.name.trim(),
    sku: input.sku.trim(),
    category: input.category,
    price: input.price.startsWith("Rs") ? input.price : formatMoney(parseMoney(input.price)),
    stock: input.stock,
    unit: input.unit.trim() || "pcs",
    status: input.stock <= 0 ? "out_of_stock" : input.status,
    imageUrl: existing?.imageUrl ?? null,
  };

  const products = existing
    ? current.products.map((row) => (row.id === existing.id ? product : row))
    : [product, ...current.products];

  const invIndex = current.inventory.findIndex((row) => row.sku === product.sku);
  const inventory = [...current.inventory];
  if (invIndex >= 0) {
    const row = inventory[invIndex] as InventoryRecord;
    inventory[invIndex] = {
      ...row,
      productName: product.name,
      category: product.category,
      onHand: product.stock,
      unit: product.unit,
      status: stockStatus(product.stock, row.reorderLevel),
      updatedAt: now,
    };
  } else {
    const reorderLevel = Math.max(5, Math.round(product.stock * 0.5));
    inventory.unshift({
      id: newId("inv"),
      productName: product.name,
      sku: product.sku,
      category: product.category,
      onHand: product.stock,
      unit: product.unit,
      reorderLevel,
      status: stockStatus(product.stock, reorderLevel),
      updatedAt: now,
    });
  }

  commit({ products, inventory });
  return product;
}

export function deleteProduct(id: string) {
  const current = ownerState();
  const product = current.products.find((row) => row.id === id);
  commit({
    products: current.products.filter((row) => row.id !== id),
    inventory: product
      ? current.inventory.filter((row) => row.sku !== product.sku)
      : current.inventory,
  });
}

/** Stock adjustment from Inventory; keeps the matching product in sync. */
export function adjustInventory(id: string, onHand: number, reorderLevel?: number) {
  const current = ownerState();
  const now = new Date().toISOString();
  let sku: string | null = null;

  const inventory = current.inventory.map((row) => {
    if (row.id !== id) return row;
    sku = row.sku;
    const nextReorder = reorderLevel ?? row.reorderLevel;
    return {
      ...row,
      onHand,
      reorderLevel: nextReorder,
      status: stockStatus(onHand, nextReorder),
      updatedAt: now,
    };
  });

  const products = current.products.map((row) =>
    row.sku === sku
      ? { ...row, stock: onHand, status: onHand <= 0 ? "out_of_stock" : "active" }
      : row,
  );

  commit({ inventory, products });
}

/* ----------------------------- orders <-> riders -------------------------- */

function riderLoad(riders: RiderRecord[], orders: OwnerOrder[]): RiderRecord[] {
  const active = new Map<string, number>();
  orders.forEach((order) => {
    if (!order.riderName) return;
    if (["delivered", "cancelled"].includes(order.status)) return;
    active.set(order.riderName, (active.get(order.riderName) ?? 0) + 1);
  });
  return riders.map((rider) => {
    if (rider.status === "offline" || rider.status === "inactive") {
      return { ...rider, activeOrders: 0 };
    }
    const load = active.get(rider.name) ?? 0;
    return { ...rider, activeOrders: load, status: load > 0 ? "on_delivery" : "available" };
  });
}

export function updateOrderStatus(id: string, status: string) {
  const current = ownerState();
  const orders = current.orders.map((row) => (row.id === id ? { ...row, status } : row));
  const riders = riderLoad(current.riders, orders).map((rider) => {
    if (status !== "delivered") return rider;
    const order = orders.find((row) => row.id === id);
    return order?.riderName === rider.name
      ? { ...rider, completedToday: rider.completedToday + 1 }
      : rider;
  });
  commit({ orders, riders });
}

export function assignRiderToOrder(orderId: string, riderName: string | null) {
  const current = ownerState();
  const orders = current.orders.map((row) =>
    row.id === orderId
      ? { ...row, riderName, status: riderName && row.status === "ready" ? "dispatched" : row.status }
      : row,
  );
  commit({ orders, riders: riderLoad(current.riders, orders) });
}

/* --------------------------------- riders -------------------------------- */

export type RiderInput = {
  name: string;
  phone: string;
  vehicle: string;
  zone: string;
  status: string;
};

export function saveRider(input: RiderInput, id?: string): RiderRecord {
  const current = ownerState();
  const existing = id ? current.riders.find((row) => row.id === id) : undefined;
  const rider: RiderRecord = {
    id: existing?.id ?? newId("rdr"),
    name: input.name.trim(),
    phone: input.phone.trim() || null,
    vehicle: input.vehicle.trim(),
    zone: input.zone.trim(),
    activeOrders: existing?.activeOrders ?? 0,
    completedToday: existing?.completedToday ?? 0,
    status: input.status,
    rating: existing?.rating ?? null,
  };
  commit({
    riders: existing
      ? current.riders.map((row) => (row.id === existing.id ? rider : row))
      : [rider, ...current.riders],
  });
  return rider;
}

export function deleteRider(id: string) {
  const current = ownerState();
  const rider = current.riders.find((row) => row.id === id);
  const orders = rider
    ? current.orders.map((row) => (row.riderName === rider.name ? { ...row, riderName: null } : row))
    : current.orders;
  commit({ riders: current.riders.filter((row) => row.id !== id), orders });
}

/* -------------------------------- suppliers ------------------------------ */

export type SupplierInput = {
  name: string;
  contactName: string;
  phone: string;
  category: string;
  paymentTerms: string;
  status: string;
};

export function saveSupplier(input: SupplierInput, id?: string): SupplierRecord {
  const current = ownerState();
  const existing = id ? current.suppliers.find((row) => row.id === id) : undefined;
  const supplier: SupplierRecord = {
    id: existing?.id ?? newId("sup"),
    name: input.name.trim(),
    contactName: input.contactName.trim() || null,
    phone: input.phone.trim() || null,
    category: input.category.trim(),
    paymentTerms: input.paymentTerms.trim(),
    outstanding: existing?.outstanding ?? formatMoney(0),
    status: input.status,
  };
  commit({
    suppliers: existing
      ? current.suppliers.map((row) => (row.id === existing.id ? supplier : row))
      : [supplier, ...current.suppliers],
  });
  return supplier;
}

export function deleteSupplier(id: string) {
  const current = ownerState();
  commit({ suppliers: current.suppliers.filter((row) => row.id !== id) });
}

/* ----------------------------- purchase orders --------------------------- */

export type PurchaseOrderInput = {
  supplierName: string;
  itemCount: number;
  total: string;
  expectedAt: string | null;
  status: string;
};

export function createPurchaseOrder(input: PurchaseOrderInput): PurchaseOrderRecord {
  const current = ownerState();
  const sequence = current.purchaseOrders.length + 2292;
  const record: PurchaseOrderRecord = {
    id: newId("po"),
    reference: `PO-${sequence}`,
    supplierName: input.supplierName,
    itemCount: input.itemCount,
    total: formatMoney(parseMoney(input.total)),
    status: input.status,
    createdAt: new Date().toISOString(),
    expectedAt: input.expectedAt,
  };
  commit({ purchaseOrders: [record, ...current.purchaseOrders] });
  return record;
}

export function setPurchaseOrderStatus(id: string, status: string) {
  const current = ownerState();
  commit({
    purchaseOrders: current.purchaseOrders.map((row) =>
      row.id === id ? { ...row, status } : row,
    ),
  });
}

/* ---------------------------------- khata -------------------------------- */

/** Records a supplier payment: ledger entry + khata balance + supplier balance. */
export function applyKhataPayment(input: {
  accountId: string;
  amount: string;
  method: string;
  paidOn: string;
  reference: string;
  note: string;
}) {
  const current = ownerState();
  const account = current.khataAccounts.find((row) => row.id === input.accountId);
  if (!account) return;

  const amount = parseMoney(input.amount);
  const nextOutstanding = Math.max(0, parseMoney(account.outstanding) - amount);
  const paidOn = input.paidOn ? new Date(input.paidOn).toISOString() : new Date().toISOString();

  const khataAccounts = current.khataAccounts.map((row) =>
    row.id === account.id
      ? {
          ...row,
          outstanding: formatMoney(nextOutstanding, row.outstanding),
          lastPaymentAt: paidOn,
          status: nextOutstanding === 0 ? "settled" : row.status,
        }
      : row,
  );

  const ledger = current.khataEntries[account.id] ?? [];
  const entry: KhataEntry = {
    id: newId("kh"),
    occurredAt: paidOn,
    type: "payment",
    reference: input.reference.trim() || `PAY-${Date.now().toString().slice(-5)}`,
    debit: null,
    credit: formatMoney(amount, account.outstanding),
    balance: formatMoney(nextOutstanding, account.outstanding),
    note: input.note.trim() || null,
  };

  const suppliers = current.suppliers.map((row) =>
    row.name === account.supplierName
      ? { ...row, outstanding: formatMoney(nextOutstanding, row.outstanding) }
      : row,
  );

  commit({
    khataAccounts,
    khataEntries: { ...current.khataEntries, [account.id]: [entry, ...ledger] },
    suppliers,
  });
}

/* --------------------------------- imports ------------------------------- */

/** Adds a CSV upload to the import history shown on the Imports screen. */
export function recordImportBatch(input: {
  entity: string;
  fileName: string;
  rowCount: number;
}): ImportBatch {
  const current = ownerState();
  const batch: ImportBatch = {
    id: newId("imp"),
    fileName: input.fileName,
    entity: input.entity,
    rowCount: input.rowCount,
    status: "processing",
    uploadedAt: new Date().toISOString(),
    message: null,
  };
  commit({ importBatches: [batch, ...current.importBatches] });
  return batch;
}
