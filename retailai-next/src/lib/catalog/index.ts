"use client";
/**
 * Mock data layer. Screens read everything through these selectors, so swapping
 * the JSON files for real API responses requires no UI changes.
 */
import categoriesJson from "@/data/categories.json";
import productsJson from "@/data/products.json";
import ordersJson from "@/data/orders.json";
import storefrontJson from "@/data/storefront.json";
import profileJson from "@/data/profile.json";
import preferencesJson from "@/data/preferences.json";
import voiceJson from "@/data/voice.json";
import { resolveImage } from "./assets";
import type {
  Category,
  CheckoutConfig,
  PaymentMethod,
  ProductFilter,
  ProductQuery,
  SortOption,
  TrackingConfig,
  Collection,
  Currency,
  CustomizationGroup,
  DeliveryLocation,
  MenuTab,
  Order,
  OrderStatus,
  OrderTab,
  Pricing,
  Product,
  PreferencesConfig,
  ProfileConfig,
  ProfileSection,
  VoiceScript,
} from "./types";

export * from "./types";
export { resolveImage } from "./assets";

/** Normalise raw records into DTOs (image refs -> URLs). */
export const PRODUCTS: Product[] = (productsJson as Product[]).map((product) => ({
  ...product,
  image: resolveImage(product.image),
}));

export const CATEGORIES: Category[] = (categoriesJson as Category[]).map((category) => ({
  ...category,
  image: resolveImage(category.image),
}));

export const ORDERS: Order[] = ordersJson as Order[];

export const CURRENCY: Currency = storefrontJson.currency as Currency;
export const PRICING: Pricing = storefrontJson.pricing as Pricing;
export const DELIVERY_LOCATION: DeliveryLocation = storefrontJson.deliveryLocation;
export const MENU_TABS: MenuTab[] = storefrontJson.menuTabs as MenuTab[];
export const ORDER_TABS: OrderTab[] = storefrontJson.orderTabs as OrderTab[];
export const CUSTOMIZATION_GROUPS: CustomizationGroup[] =
  storefrontJson.customizationGroups as CustomizationGroup[];
export const SORT_OPTIONS: SortOption[] = storefrontJson.sortOptions as SortOption[];
export const PRODUCT_FILTERS: ProductFilter[] = storefrontJson.productFilters as ProductFilter[];
export const PAYMENT_METHODS: PaymentMethod[] = storefrontJson.paymentMethods as PaymentMethod[];
export const CHECKOUT: CheckoutConfig = storefrontJson.checkout as CheckoutConfig;
export const TRACKING: TrackingConfig = storefrontJson.tracking as TrackingConfig;
export const PROFILE: ProfileConfig = profileJson as ProfileConfig;
export const PREFERENCES: PreferencesConfig = preferencesJson as PreferencesConfig;
export const VOICE_SCRIPT: VoiceScript = voiceJson as VoiceScript;

export const PROFILE_SECTIONS: ProfileSection[] = PROFILE.sections;

const ORDER_STATUS_LABELS = storefrontJson.orderStatusLabels as Record<OrderStatus, string>;

export function getProduct(id: string): Product | undefined {
  return PRODUCTS.find((product) => product.id === id);
}

export function getProducts(ids: string[]): Product[] {
  return ids.map((id) => getProduct(id)).filter((p): p is Product => Boolean(p));
}

export function getProductsByTab(tab: string): Product[] {
  return PRODUCTS.filter((product) => product.tab === tab);
}

export function getProductsByCategory(categoryId: string): Product[] {
  return PRODUCTS.filter((product) => product.categoryId === categoryId);
}

export function getCategory(id: string): Category | undefined {
  return CATEGORIES.find((category) => category.id === id);
}

function matchesQuery(product: Product, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const haystack = [product.name, product.description, product.ingredients, ...product.keywords]
    .join(" ")
    .toLowerCase();
  return needle.split(/\s+/).every((token) => {
    const singular = token.length > 3 && token.endsWith("s") ? token.slice(0, -1) : token;
    return haystack.includes(token) || haystack.includes(singular);
  });
}

/** Single entry point for every product list: search + tab + category + sort. */
export function queryProducts(options: ProductQuery = {}): Product[] {
  const { query = "", tab, categoryId, sort = "popular", availableOnly = false } = options;
  let items = PRODUCTS.filter(
    (product) =>
      (!tab || product.tab === tab) &&
      (!categoryId || product.categoryId === categoryId) &&
      (!availableOnly || product.available) &&
      matchesQuery(product, query),
  );
  items = [...items];
  if (sort === "price-asc") items.sort((a, b) => a.price - b.price);
  else if (sort === "price-desc") items.sort((a, b) => b.price - a.price);
  else if (sort === "rating") items.sort((a, b) => b.rating - a.rating);
  else items.sort((a, b) => b.reviews - a.reviews);
  return items;
}

export function searchProducts(query: string): Product[] {
  return queryProducts({ query });
}

export function getCollection(id: string): Collection | undefined {
  const raw = storefrontJson.collections.find((collection) => collection.id === id);
  if (!raw) return undefined;
  return {
    id: raw.id,
    title: raw.title,
    ...("actionLabel" in raw && raw.actionLabel ? { actionLabel: raw.actionLabel } : {}),
    products: getProducts(raw.productIds),
  };
}

export function getCollections(ids: string[]): Collection[] {
  return ids.map((id) => getCollection(id)).filter((c): c is Collection => Boolean(c));
}

export function getOrders(status?: OrderStatus): Order[] {
  return status ? ORDERS.filter((order) => order.status === status) : ORDERS;
}

export function getOrderStatusLabel(status: OrderStatus): string {
  return ORDER_STATUS_LABELS[status] ?? status;
}

/** Default selection map for the customization groups, e.g. { cheese: "Yes" }. */
export function getDefaultCustomizations(): Record<string, string> {
  return Object.fromEntries(
    CUSTOMIZATION_GROUPS.map((group) => [group.id, group.options[group.defaultIndex] ?? ""]),
  );
}

/** Currency-aware price formatter driven by the storefront config. */
export function formatPrice(value: number): string {
  return `${CURRENCY.symbol} ${value.toLocaleString(CURRENCY.locale)}`;
}

/** Cart totals derived from the pricing config rather than hardcoded numbers. */
export function calculateTotals(subtotal: number, hasItems: boolean) {
  const deliveryFee = hasItems ? PRICING.deliveryFee : 0;
  const discount = subtotal >= PRICING.discountThreshold ? PRICING.discount : 0;
  return { deliveryFee, discount, total: Math.max(subtotal + deliveryFee - discount, 0) };
}
