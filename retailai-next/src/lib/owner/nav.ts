"use client";
import type { ModuleId } from "./permissions";

/** Sidebar navigation config for the Owner Portal. Route-driven, no inline UI data. */
export type OwnerNavItem = {
  id: string;
  label: string;
  /** Lucide icon key resolved by the icon registry. */
  icon: string;
  to: string;
  /** Permission module that gates this item (see PERMISSION_MODULES). */
  module: ModuleId;
};

export const OWNER_NAV: OwnerNavItem[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: "layout-dashboard",
    to: "/owner",
    module: "dashboard",
  },
  { id: "orders", label: "Orders", icon: "receipt", to: "/owner/orders", module: "orders" },
  { id: "products", label: "Products", icon: "package", to: "/owner/products", module: "products" },
  {
    id: "inventory",
    label: "Inventory",
    icon: "boxes",
    to: "/owner/inventory",
    module: "inventory",
  },
  {
    id: "suppliers",
    label: "Suppliers",
    icon: "truck",
    to: "/owner/suppliers",
    module: "suppliers",
  },
  {
    id: "purchase-orders",
    label: "Purchase Orders",
    icon: "clipboard-check",
    to: "/owner/purchase-orders",
    module: "purchase-orders",
  },
  { id: "khata", label: "Khata", icon: "book-open", to: "/owner/khata", module: "supplier-khata" },
  { id: "riders", label: "Riders", icon: "bike", to: "/owner/riders", module: "riders" },
  {
    id: "analytics",
    label: "Analytics",
    icon: "bar-chart-3",
    to: "/owner/analytics",
    module: "analytics",
  },
  {
    id: "voice",
    label: "Voice Analytics",
    icon: "mic",
    to: "/owner/voice-analytics",
    module: "voice-analytics",
  },
  {
    id: "forecast",
    label: "AI Forecast",
    icon: "brain",
    to: "/owner/forecast",
    module: "ai-forecast",
  },
  { id: "agent", label: "AI Agent", icon: "sparkles", to: "/owner/agent", module: "ai-agent" },
  {
    id: "imports",
    label: "Data Imports",
    icon: "package-plus",
    to: "/owner/imports",
    module: "imports",
  },
  { id: "users", label: "Users & Permissions", icon: "users", to: "/owner/users", module: "users" },
  {
    id: "settings",
    label: "Settings",
    icon: "settings",
    to: "/owner/settings",
    module: "settings",
  },
];

/** Destinations pinned to the mobile bottom bar; the rest live in the drawer. */
export const OWNER_PRIMARY_NAV_IDS: string[] = ["dashboard", "orders", "products", "inventory"];
