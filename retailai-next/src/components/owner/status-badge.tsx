"use client";
/**
 * Single reusable status badge for the whole Owner Portal.
 * Statuses are looked up in a registry so new backend statuses only need a
 * registry entry — never a new component. Colour is always paired with text.
 */
import { StatusPill } from "@/components/owner/primitives";

export type BadgeTone = "neutral" | "info" | "success" | "warning" | "critical";

type StatusMeta = { label: string; tone: BadgeTone };

/** Extend this map as the backend introduces new status values. */
export const STATUS_REGISTRY: Record<string, StatusMeta> = {
  approved: { label: "Approved", tone: "success" },
  pending: { label: "Pending", tone: "warning" },
  awaiting_approval: { label: "Awaiting Approval", tone: "warning" },
  rejected: { label: "Rejected", tone: "critical" },
  received: { label: "Received", tone: "success" },
  partially_received: { label: "Partially Received", tone: "info" },
  critical: { label: "Critical", tone: "critical" },
  low: { label: "Low", tone: "warning" },
  in_stock: { label: "In Stock", tone: "success" },
  out_of_stock: { label: "Out of Stock", tone: "critical" },
  active: { label: "Active", tone: "success" },
  inactive: { label: "Inactive", tone: "neutral" },
  invited: { label: "Invited", tone: "info" },
  suspended: { label: "Suspended", tone: "critical" },
  paid: { label: "Paid", tone: "success" },
  unpaid: { label: "Unpaid", tone: "critical" },
  draft: { label: "Draft", tone: "neutral" },
  cancelled: { label: "Cancelled", tone: "neutral" },
  /* Customer order lifecycle */
  new: { label: "New", tone: "info" },
  accepted: { label: "Accepted", tone: "info" },
  preparing: { label: "Preparing", tone: "warning" },
  ready: { label: "Ready", tone: "info" },
  dispatched: { label: "Dispatched", tone: "info" },
  delivered: { label: "Delivered", tone: "success" },
  refunded: { label: "Refunded", tone: "neutral" },
  /* Khata / payables */
  overdue: { label: "Overdue", tone: "critical" },
  due_soon: { label: "Due Soon", tone: "warning" },
  settled: { label: "Settled", tone: "success" },
  sent: { label: "Sent", tone: "info" },
  /* Riders */
  available: { label: "Available", tone: "success" },
  on_delivery: { label: "On Delivery", tone: "info" },
  offline: { label: "Offline", tone: "neutral" },
  /* Voice sessions */
  order_placed: { label: "Order Placed", tone: "success" },
  abandoned: { label: "Abandoned", tone: "warning" },
  not_understood: { label: "Not Understood", tone: "critical" },
  handed_off: { label: "Handed to Agent", tone: "info" },
  /* Imports */
  processing: { label: "Processing", tone: "info" },
  queued: { label: "Queued", tone: "neutral" },
  completed: { label: "Completed", tone: "success" },
  failed: { label: "Failed", tone: "critical" },
};

/** Normalises "Partially Received", "PARTIALLY-RECEIVED", etc. to a registry key. */
export function statusKey(status: string): string {
  return status
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function titleCase(status: string): string {
  return status
    .replace(/[_-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((word) => word[0]!.toUpperCase() + word.slice(1))
    .join(" ");
}

export function StatusBadge({
  status,
  label,
  tone,
  className,
}: {
  /** Raw status value from a future API response. */
  status: string | null | undefined;
  /** Optional label override (e.g. already localised by the backend). */
  label?: string | undefined;
  /** Optional tone override for statuses outside the registry. */
  tone?: BadgeTone | undefined;
  className?: string | undefined;
}) {
  if (!status)
    return <StatusPill label={label ?? "Unknown"} tone={tone ?? "neutral"} className={className} />;
  const meta = STATUS_REGISTRY[statusKey(status)];
  return (
    <StatusPill
      label={label ?? meta?.label ?? titleCase(status)}
      tone={tone ?? meta?.tone ?? "neutral"}
      className={className}
    />
  );
}
