"use client";
/** Presentation-only formatting helpers (no business logic). */

/** Relative time for API timestamps; returns a dash placeholder when absent. */
export function formatRelativeTime(iso: string | null | undefined, fallback = "—"): string {
  if (!iso) return fallback;
  const timestamp = new Date(iso).getTime();
  if (Number.isNaN(timestamp)) return fallback;
  const diff = Date.now() - timestamp;
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

/** Absolute date, e.g. "12 Mar 2026". */
export function dateLabel(iso: string | null | undefined, fallback = "—"): string {
  if (!iso) return fallback;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

/** Absolute date + time, used by order/activity tables. */
export function dateTimeLabel(iso: string | null | undefined, fallback = "—"): string {
  if (!iso) return fallback;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return fallback;
  return `${date.toLocaleDateString(undefined, { day: "2-digit", month: "short" })}, ${date.toLocaleTimeString(
    undefined,
    { hour: "2-digit", minute: "2-digit" },
  )}`;
}

/** Renders an optional API string, falling back to a dash placeholder. */
export function plainText(value: string | null | undefined, fallback = "—"): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

/** "12 units" style label where the unit comes from the API. */
export function quantityLabel(value: number | null | undefined, unit?: string | null): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return unit ? `${value} ${unit}` : String(value);
}
