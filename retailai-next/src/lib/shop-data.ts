"use client";
/**
 * Backwards-compatible facade over the data layer in `@/lib/catalog`.
 * Prefer importing from `@/lib/catalog` in new code.
 */
export {
  CATEGORIES,
  CURRENCY,
  CUSTOMIZATION_GROUPS,
  DELIVERY_LOCATION,
  MENU_TABS,
  ORDERS as MOCK_ORDERS,
  ORDER_TABS,
  PRICING,
  PRODUCTS,
  PROFILE,
  PROFILE_SECTIONS,
  calculateTotals,
  formatPrice,
  getCollection,
  getCollections,
  getDefaultCustomizations,
  getOrderStatusLabel,
  getOrders,
  getProduct,
  getProducts,
  getProductsByTab,
  resolveImage,
} from "@/lib/catalog";
export type {
  Category,
  Collection,
  Currency,
  CustomizationGroup,
  DeliveryLocation,
  MenuTab,
  Order,
  Order as MockOrder,
  OrderLine,
  OrderStatus,
  OrderTab,
  Pricing,
  Product,
  ProfileConfig,
  ProfileRow,
  ProfileSection,
} from "@/lib/catalog";

import { PRICING } from "@/lib/catalog";

/** @deprecated use PRICING.deliveryFee */
export const DELIVERY_FEE = PRICING.deliveryFee;
/** @deprecated use PRICING.discount */
export const DISCOUNT = PRICING.discount;
