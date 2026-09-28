"use client";
/**
 * Section-scoped empty and error cards.
 * Errors and empties are always rendered inside the owning panel so the rest of
 * the page stays interactive. Presets keep copy consistent across screens.
 */
import {
  AlertTriangle,
  Bell,
  BrainCircuit,
  ClipboardList,
  PackageSearch,
  RefreshCw,
  SearchX,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export function SectionError({
  message,
  onRetry,
  title = "Couldn't load this section",
  className,
}: {
  message: string;
  onRetry: () => void;
  title?: string | undefined;
  className?: string | undefined;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center gap-3 rounded-2xl border border-destructive/25 bg-destructive/5 px-4 py-7 text-center",
        className,
      )}
    >
      <span className="grid h-10 w-10 place-items-center rounded-full bg-destructive/10 text-brand-danger">
        <AlertTriangle className="h-5 w-5" />
      </span>
      <p className="text-sm font-semibold text-brand-navy-deep ">{title}</p>
      <p className="max-w-sm text-xs text-brand-secondary-text ">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-1.5 rounded-lg border border-brand-border bg-white px-3 py-1.5 text-xs font-semibold text-brand-navy-deep transition-colors hover:bg-brand-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan "
      >
        <RefreshCw className="h-3.5 w-3.5" />
        Retry
      </button>
    </div>
  );
}

export function SectionEmpty({
  title,
  description,
  icon: Icon = PackageSearch,
  action,
  className,
}: {
  title: string;
  description?: string | undefined;
  icon?: LucideIcon | undefined;
  action?: React.ReactNode;
  className?: string | undefined;
}) {
  return (
    <div className={cn("flex flex-col items-center gap-2.5 px-4 py-9 text-center", className)}>
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-cyan/10 text-brand-accent">
        <Icon className="h-6 w-6" />
      </span>
      <p className="text-sm font-semibold text-brand-navy-deep ">{title}</p>
      {description ? (
        <p className="max-w-sm text-xs text-brand-secondary-text ">{description}</p>
      ) : null}
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}

type EmptyPreset = { title: string; description: string; icon: LucideIcon };

/** Copy presets — pages pick one instead of inventing their own wording. */
export const EMPTY_PRESETS: Record<
  | "orders"
  | "products"
  | "inventory"
  | "suppliers"
  | "riders"
  | "khata"
  | "voiceSessions"
  | "imports"
  | "purchaseOrders"
  | "supplierPayments"
  | "lowStock"
  | "forecast"
  | "searchResults"
  | "notifications",
  EmptyPreset
> = {
  orders: {
    title: "No orders yet",
    description: "Customer orders will appear here as soon as they come in.",
    icon: ClipboardList,
  },
  products: {
    title: "No products yet",
    description: "Add products or import a CSV to build your catalog.",
    icon: PackageSearch,
  },
  inventory: {
    title: "No stock records",
    description: "Stock levels appear here once your catalog is set up.",
    icon: PackageSearch,
  },
  suppliers: {
    title: "No suppliers yet",
    description: "Add the suppliers you buy from to track orders and payments.",
    icon: Wallet,
  },
  riders: {
    title: "No riders yet",
    description: "Delivery riders you add will be listed here with live status.",
    icon: ClipboardList,
  },
  khata: {
    title: "No ledger accounts",
    description: "Supplier ledgers appear here once purchases are recorded.",
    icon: Wallet,
  },
  voiceSessions: {
    title: "No voice sessions",
    description: "Voice ordering transcripts and intents will be listed here.",
    icon: SearchX,
  },
  imports: {
    title: "No imports yet",
    description: "Uploaded CSV files and their results will be listed here.",
    icon: ClipboardList,
  },
  purchaseOrders: {
    title: "No purchase orders",
    description: "Purchase orders will appear here once they are raised.",
    icon: ClipboardList,
  },
  supplierPayments: {
    title: "No supplier payments",
    description: "Recorded payments against supplier ledgers will show up here.",
    icon: Wallet,
  },
  lowStock: {
    title: "No low stock products",
    description: "Items falling below their threshold will be listed here.",
    icon: PackageSearch,
  },
  forecast: {
    title: "No forecast available",
    description: "Demand forecasts appear once enough order history is available.",
    icon: BrainCircuit,
  },
  searchResults: {
    title: "No results found",
    description: "Try a different search term or clear the active filters.",
    icon: SearchX,
  },
  notifications: {
    title: "No notifications",
    description: "You're all caught up — new alerts will land here.",
    icon: Bell,
  },
};

export function PresetEmpty({
  preset,
  action,
}: {
  preset: keyof typeof EMPTY_PRESETS;
  action?: React.ReactNode;
}) {
  const meta = EMPTY_PRESETS[preset];
  return (
    <SectionEmpty
      title={meta.title}
      description={meta.description}
      icon={meta.icon}
      action={action}
    />
  );
}
