"use client";
/**
 * Store Settings DTOs + repository seam.
 * Values are intentionally blank so nothing looks like real business data. Swap
 * the two functions for API calls later; the UI stays untouched.
 */
import settingsData from "@/data/owner/settings.json";

export type StoreInformation = {
  storeName: string;
  businessType: string;
  contactPhone: string;
  contactEmail: string;
  address: string;
  currencyCode: string;
  timeZone: string;
};

export type InventorySettings = {
  /** Units at or below which an item counts as low stock. */
  lowStockThreshold: string;
  /** Units at or below which an item counts as critical. */
  criticalStockThreshold: string;
  /** Enables the low-stock alert surfaces across the dashboard. */
  lowStockAlertsEnabled: boolean;
  /** Show out-of-stock products to customers. */
  allowNegativeStock: boolean;
  /** Default reorder quantity suggestion. */
  defaultReorderQuantity: string;
};

export type NotificationSettings = {
  lowStockAlerts: boolean;
  purchaseOrderUpdates: boolean;
  supplierPaymentReminders: boolean;
  aiInsights: boolean;
  emailChannel: boolean;
  pushChannel: boolean;
};

export type AccountSettings = {
  /** UI language preference for the dashboard. */
  language: string;
  theme: "system" | "light" | "dark";
  /** Two-factor preference flag (UI only). */
  twoFactorEnabled: boolean;
};

export type StoreSettings = {
  store: StoreInformation;
  inventory: InventorySettings;
  notifications: NotificationSettings;
  account: AccountSettings;
};

export const EMPTY_STORE_SETTINGS: StoreSettings = {
  store: {
    storeName: "",
    businessType: "",
    contactPhone: "",
    contactEmail: "",
    address: "",
    currencyCode: "",
    timeZone: "",
  },
  inventory: {
    lowStockThreshold: "",
    criticalStockThreshold: "",
    lowStockAlertsEnabled: false,
    allowNegativeStock: false,
    defaultReorderQuantity: "",
  },
  notifications: {
    lowStockAlerts: false,
    purchaseOrderUpdates: false,
    supplierPaymentReminders: false,
    aiInsights: false,
    emailChannel: false,
    pushChannel: false,
  },
  account: {
    language: "",
    theme: "system",
    twoFactorEnabled: false,
  },
};

/** Options are configuration, not business data — replace with API metadata. */
export const BUSINESS_TYPE_OPTIONS = [
  "Restaurant",
  "Grocery Store",
  "Pharmacy",
  "Clothing Brand",
  "Retail Store",
];

export const CURRENCY_OPTIONS = ["PKR", "USD", "EUR", "GBP", "AED"];

export const LANGUAGE_OPTIONS = [
  { value: "en", label: "English" },
  { value: "ur", label: "اردو (Urdu)" },
];

/** Mock `GET /owner/settings`. Values live in `src/data/owner/settings.json`. */
export async function fetchStoreSettings(): Promise<StoreSettings> {
  return { ...EMPTY_STORE_SETTINGS, ...(settingsData as unknown as StoreSettings) };
}

/** Replace with `PATCH /owner/settings`. */
export async function saveStoreSettings(_settings: StoreSettings): Promise<void> {
  return;
}
