"use client";
import {
  AlertTriangle,
  BarChart3,
  Bell,
  Bike,
  BookOpen,
  Boxes,
  Brain,
  ClipboardCheck,
  CreditCard,
  Info,
  LayoutDashboard,
  type LucideIcon,
  Mic,
  Package,
  PackagePlus,
  Receipt,
  Settings,
  ShoppingBag,
  Sparkles,
  Truck,
  Users,
  Wallet,
} from "lucide-react";

/**
 * Icon registry: backend/config data references icons by key, so no component
 * ever hardcodes an icon for a specific business record.
 */
const ICONS: Record<string, LucideIcon> = {
  "alert-triangle": AlertTriangle,
  "bar-chart-3": BarChart3,
  bell: Bell,
  bike: Bike,
  "book-open": BookOpen,
  boxes: Boxes,
  brain: Brain,
  "clipboard-check": ClipboardCheck,
  "credit-card": CreditCard,
  info: Info,
  "layout-dashboard": LayoutDashboard,
  mic: Mic,
  package: Package,
  "package-plus": PackagePlus,
  receipt: Receipt,
  settings: Settings,
  "shopping-bag": ShoppingBag,
  sparkles: Sparkles,
  truck: Truck,
  users: Users,
  wallet: Wallet,
};

export function OwnerIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICONS[name] ?? Sparkles;
  return <Icon className={className} aria-hidden="true" />;
}
