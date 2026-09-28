"use client";

import { useNavigate } from "@/lib/router-compat";import {
  BellOff,
  BookOpen,
  CheckCheck,
  ChevronRight,
  CreditCard,
  type LucideIcon,
  ShieldCheck,
  ShoppingBag,
  SlidersHorizontal,
  Tag,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { BottomNav } from "@/components/shop/nav";
import { Screen, ScreenHeader } from "@/components/shop/primitives";
import {
  MOCK_NOTIFICATIONS,
  NOTIFICATION_FILTERS,
  NOTIFICATION_STYLES,
  type CustomerNotification,
  type NotificationFilter,
  type NotificationLink,
} from "@/lib/notifications-mock";
import { useOrders } from "@/lib/orders";
import { cn } from "@/lib/utils";



const ICONS: Record<string, LucideIcon> = {
  "shopping-bag": ShoppingBag,
  "credit-card": CreditCard,
  "book-open": BookOpen,
  tag: Tag,
  "shield-check": ShieldCheck,
};

const FILTER_ICONS: Record<string, LucideIcon> = {
  all: SlidersHorizontal,
  orders: ShoppingBag,
  payments: CreditCard,
  khata: BookOpen,
  promotions: Tag,
};

type GroupId = "today" | "yesterday" | "earlier";

const GROUP_LABEL: Record<GroupId, string> = {
  today: "Today",
  yesterday: "Yesterday",
  earlier: "Earlier",
};

function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy.getTime();
}

function groupOf(iso: string): GroupId {
  const days = Math.round((startOfDay(new Date()) - startOfDay(new Date(iso))) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return "earlier";
}

function formatStamp(iso: string): string {
  const date = new Date(iso);
  const time = date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const group = groupOf(iso);
  if (group === "today") return time;
  if (group === "yesterday") return `Yesterday, ${time}`;
  return `${date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}, ${time}`;
}

function NotificationsScreen() {
  const navigate = useNavigate();
  const { latestOrder } = useOrders();
  const [items, setItems] = useState<CustomerNotification[]>(MOCK_NOTIFICATIONS);

  const [filter, setFilter] = useState<NotificationFilter["id"]>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const visible = useMemo(
    () => items.filter((item) => (filter === "all" ? true : item.kind === filter)),
    [items, filter],
  );

  const unreadCount = visible.filter((item) => !item.read).length;

  const groups = useMemo(() => {
    const order: GroupId[] = ["today", "yesterday", "earlier"];
    return order
      .map((id) => ({
        id,
        label: GROUP_LABEL[id],
        rows: visible
          .filter((item) => groupOf(item.createdAt) === id)
          .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
      }))
      .filter((group) => group.rows.length > 0);
  }, [visible]);

  const countFor = (id: NotificationFilter["id"]) =>
    id === "all"
      ? items.filter((item) => !item.read).length
      : items.filter((item) => item.kind === id && !item.read).length;

  const markAllRead = () =>
    setItems((current) =>
      current.map((item) =>
        filter === "all" || item.kind === filter ? { ...item, read: true } : item,
      ),
    );

  const toggleExpanded = (item: CustomerNotification) => {
    setExpandedId((current) => (current === item.id ? null : item.id));
    if (!item.read) {
      setItems((current) => current.map((r) => (r.id === item.id ? { ...r, read: true } : r)));
    }
  };

  /** Notification deep links keep Orders/Track/Profile in sync with the feed. */
  const openLink = (item: CustomerNotification) => {
    const link = item.link as NotificationLink | undefined;
    if (!link) return;
    if (!item.read) setItems((current) => current.map((r) => (r.id === item.id ? { ...r, read: true } : r)));
    if (link === "/track") {
      navigate(
        latestOrder
          ? { to: "/track", search: { order: latestOrder.id } }
          : { to: "/orders" },
      );
      return;
    }
    navigate({ to: link });
  };

  const toggleRead = (id: string) =>
    setItems((current) => current.map((r) => (r.id === id ? { ...r, read: !r.read } : r)));

  const remove = (id: string) => {
    setRemovingId(id);
    window.setTimeout(() => {
      setItems((current) => current.filter((r) => r.id !== id));
      setRemovingId((current) => (current === id ? null : current));
    }, 220);
  };

  return (
    <>
      <Screen>
        <div className="mx-auto w-full max-w-6xl">
          <ScreenHeader
            title="Notifications"
            backTo="/home"
            right={
              <button
                type="button"
                onClick={markAllRead}
                disabled={unreadCount === 0}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-2 text-[13px] font-bold text-brand-accent transition-colors hover:text-brand-navy-deep disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan"
              >
                <CheckCheck className="h-4 w-4" />
                <span className="hidden sm:inline">Mark all as read</span>
                <span className="sm:hidden">Read all</span>
              </button>
            }
          />

          <div className="mt-6 lg:grid lg:grid-cols-[260px_minmax(0,1fr)] lg:items-start lg:gap-8 xl:gap-12">
            {/* Filters: horizontal chip rail on mobile, sticky rail on desktop. */}
            <aside className="lg:sticky lg:top-10">
              <h2 className="sr-only">Filter notifications</h2>
              <div className="scroll-rail -mx-5 flex gap-2 overflow-x-auto px-5 pb-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0">
                {NOTIFICATION_FILTERS.map((chip) => {
                  const Icon = FILTER_ICONS[chip.id] ?? SlidersHorizontal;
                  const active = filter === chip.id;
                  const count = countFor(chip.id);
                  return (
                    <button
                      key={chip.id}
                      type="button"
                      onClick={() => setFilter(chip.id)}
                      aria-pressed={active}
                      className={cn(
                        "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-2xl border px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan lg:w-full lg:justify-start",
                        active
                          ? "border-brand-teal bg-brand-teal/12 text-brand-accent"
                          : "border-brand-border bg-brand-card text-brand-secondary-text hover:border-brand-teal/50 hover:text-brand-accent",
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{chip.label}</span>
                      {count > 0 ? (
                        <span
                          className={cn(
                            "ms-auto grid h-5 min-w-5 place-items-center rounded-full px-1 text-[10px] font-bold",
                            active ? "bg-brand-teal text-white" : "bg-brand-surface-2 text-brand-secondary-text",
                          )}
                        >
                          {count}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </aside>

            <section className="mt-6 lg:mt-0">
              {groups.length === 0 ? (
                <EmptyState label={NOTIFICATION_FILTERS.find((f) => f.id === filter)?.label ?? "All"} />
              ) : (
                <div className="space-y-7">
                  {groups.map((group) => (
                    <div key={group.id}>
                      <div className="flex items-center gap-3">
                        <h3 className="text-sm font-bold text-brand-navy-deep">{group.label}</h3>
                        <span className="h-px flex-1 bg-brand-border-subtle" />
                      </div>
                      <ul className="mt-3 space-y-3 md:grid md:auto-rows-min md:grid-cols-2 md:items-start md:gap-3 md:space-y-0 lg:grid-cols-1 xl:grid-cols-2">
                        {group.rows.map((item) => (
                          <NotificationRow
                            key={item.id}
                            item={item}
                            expanded={expandedId === item.id}
                            removing={removingId === item.id}
                            onToggle={() => toggleExpanded(item)}
                            onOpen={item.link ? () => openLink(item) : undefined}
                            onToggleRead={() => toggleRead(item.id)}
                            onDelete={() => remove(item.id)}
                          />
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </Screen>
      <BottomNav />
    </>
  );
}

function NotificationRow({
  item,
  expanded,
  removing,
  onToggle,
  onOpen,
  onToggleRead,
  onDelete,
}: {
  item: CustomerNotification;
  expanded: boolean;
  removing: boolean;
  onToggle: () => void;
  onOpen?: (() => void) | undefined;
  onToggleRead: () => void;
  onDelete: () => void;
}) {
  const style = NOTIFICATION_STYLES[item.kind];
  const Icon = ICONS[style.icon] ?? ShoppingBag;
  // Timestamps format with the visitor's locale/timezone, so render them after
  // hydration to keep the SSR markup stable.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  return (
    <li
      className={cn(
        "overflow-hidden rounded-2xl border border-brand-border-subtle bg-brand-card shadow-[0_10px_30px_-24px_rgba(7,27,51,0.45)] transition-all duration-200",
        !item.read && "border-s-4 border-s-brand-teal",
        removing
          ? "pointer-events-none translate-x-2 scale-[0.98] opacity-0"
          : "animate-fade-in opacity-100",
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-start gap-3 p-4 text-start transition-colors hover:bg-brand-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan md:gap-4 md:p-5"
      >
        <span className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-full", style.circle)}>
          <Icon className="h-5 w-5" />
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex items-start justify-between gap-3">
            <span
              className={cn(
                "min-w-0 text-[15px] leading-snug text-brand-navy-deep md:text-base",
                item.read ? "font-semibold" : "font-extrabold",
              )}
            >
              {item.title}
            </span>
            <span className="flex shrink-0 flex-col items-end gap-1.5">
              <span className="whitespace-nowrap text-[11px] font-medium text-brand-muted md:text-xs">
                {hydrated ? formatStamp(item.createdAt) : ""}
              </span>
              {!item.read ? <span className="h-2 w-2 rounded-full bg-brand-teal" /> : null}
            </span>
          </span>
          <span className="mt-1 block text-[13px] leading-relaxed text-brand-secondary-text md:text-sm">
            {item.message}
          </span>
        </span>

        <ChevronRight
          className={cn(
            "mt-1 h-4 w-4 shrink-0 text-brand-muted transition-transform rtl:-scale-x-100",
            expanded && "rotate-90",
          )}
        />
      </button>

      <div
        className={cn(
          "grid transition-all duration-200 ease-out",
          expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="overflow-hidden">
          <div className="border-t border-brand-border-subtle px-4 pb-4 pt-3 md:px-5">
            {item.detail ? (
              <p className="text-[13px] leading-relaxed text-brand-secondary-text md:text-sm">
                {item.detail}
              </p>
            ) : null}
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              {onOpen ? (
                <button
                  type="button"
                  onClick={onOpen}
                  className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-brand-gradient px-4 text-sm font-bold text-white transition-transform hover:scale-[1.01] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan"
                >
                  <ChevronRight className="h-4 w-4 rtl:-scale-x-100" />
                  View details
                </button>
              ) : null}
              <button
                type="button"
                onClick={onToggleRead}
                className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-brand-border bg-brand-card px-4 text-sm font-bold text-brand-accent transition-colors hover:bg-brand-teal/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan"
              >
                <CheckCheck className="h-4 w-4" />
                {item.read ? "Mark as unread" : "Mark as read"}
              </button>
              <button
                type="button"
                onClick={onDelete}
                className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-brand-border bg-brand-card px-4 text-sm font-bold text-brand-danger transition-colors hover:bg-brand-danger/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </button>
            </div>
          </div>
        </div>
      </div>
    </li>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="animate-fade-in rounded-3xl border border-brand-border-subtle bg-brand-card px-6 py-14 text-center shadow-[0_10px_30px_-24px_rgba(7,27,51,0.45)] md:py-20">
      <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-brand-teal/10 text-brand-accent">
        <BellOff className="h-7 w-7" />
      </span>
      <h3 className="mt-5 text-lg font-extrabold text-brand-navy-deep">
        No {label.toLowerCase() === "all" ? "" : `${label.toLowerCase()} `}notifications
      </h3>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-brand-secondary-text">
        You&apos;re all caught up. New updates for this filter will show up here.
      </p>
    </div>
  );
}

export default NotificationsScreen;
