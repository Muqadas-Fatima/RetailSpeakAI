"use client";
import { Link } from "@/lib/router-compat";
import { Bell } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { EmptyState, ErrorState, SkeletonRows, StatusPill } from "@/components/owner/primitives";
import { useOwnerNotifications } from "@/lib/owner/hooks";
import type { NotificationCategory } from "@/lib/owner/types";
import { cn } from "@/lib/utils";

const CATEGORY_LABEL: Record<NotificationCategory, string> = {
  "low-stock": "Low Stock",
  "purchase-order": "Purchase Order",
  supplier: "Supplier Alert",
  ai: "AI Alert",
};

const CATEGORY_TONE: Record<NotificationCategory, "critical" | "info" | "warning" | "success"> = {
  "low-stock": "critical",
  "purchase-order": "info",
  supplier: "warning",
  ai: "success",
};

/** Relative time formatting stays in the UI; the API only sends ISO timestamps. */
function formatRelative(iso: string): string {
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return "";
  const minutes = Math.round((Date.now() - time) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function NotificationCenter() {
  const { data, isLoading, error, refetch, unreadCount } = useOwnerNotifications();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  const items = data ?? [];

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label="Notifications"
        aria-expanded={open}
        className="relative grid h-10 w-10 place-items-center rounded-xl border border-brand-border bg-white text-brand-navy-deep transition-colors hover:bg-brand-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan "
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 ? (
          <span className="absolute -end-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-brand-teal px-1 text-[10px] font-bold text-white">
            {unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="fixed inset-x-3 top-[72px] z-50 max-h-[70svh] overflow-hidden rounded-2xl border border-brand-border-subtle bg-white shadow-[0_24px_60px_-24px_rgba(7,27,51,0.45)] sm:absolute sm:inset-x-auto sm:end-0 sm:top-12 sm:w-[380px]">
          <header className="flex items-center justify-between border-b border-brand-border-subtle px-4 py-3 ">
            <h2 className="text-sm font-bold text-brand-navy-deep ">Notifications</h2>
            <span className="text-xs text-brand-secondary-text ">{unreadCount} unread</span>
          </header>

          <div className="scroll-touch max-h-[52svh] overflow-y-auto">
            {isLoading ? (
              <div className="p-4">
                <SkeletonRows rows={3} />
              </div>
            ) : error ? (
              <ErrorState message={error} onRetry={refetch} />
            ) : items.length === 0 ? (
              <EmptyState
                title="No notifications yet"
                description="Low stock, purchase order, supplier and AI alerts will appear here."
              />
            ) : (
              <ul>
                {items.map((item) => (
                  <li key={item.id}>
                    <Link
                      to={item.href}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "flex gap-3 border-b border-brand-border-subtle px-4 py-3 transition-colors hover:bg-brand-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan ",
                        !item.read && "bg-brand-cyan/5",
                      )}
                    >
                      <span
                        className={cn(
                          "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                          item.read ? "bg-brand-muted/50" : "bg-brand-teal",
                        )}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <StatusPill
                            label={CATEGORY_LABEL[item.category]}
                            tone={CATEGORY_TONE[item.category]}
                          />
                          <span className="shrink-0 text-[11px] text-brand-muted">
                            {formatRelative(item.createdAt)}
                          </span>
                        </span>
                        <span className="mt-1.5 block truncate text-sm font-semibold text-brand-navy-deep ">
                          {item.title}
                        </span>
                        <span className="mt-0.5 block text-xs text-brand-secondary-text ">
                          {item.message}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
