"use client";
/**
 * Customer notification feed.
 *
 * Rows come from `src/data/notifications.json` — no notification content is
 * hardcoded in components. Swap `fetchNotifications` for a real request later
 * (`GET /notifications`) and the screen stays unchanged.
 */
import notificationsData from "@/data/notifications.json";

export type NotificationKind = "orders" | "payments" | "khata" | "promotions" | "system";

export type CustomerNotification = {
  id: string;
  kind: NotificationKind;
  title: string;
  message: string;
  /** ISO timestamp; grouping/formatting happens in the UI. */
  createdAt: string;
  read: boolean;
  /** Optional extra detail revealed when the row is expanded. */
  detail?: string;
  /** Where tapping the row's primary action takes the customer. */
  link?: NotificationLink;
};

/** Customer routes a notification can deep-link into. */
export type NotificationLink = "/orders" | "/track" | "/profile" | "/menu" | "/home";

export type NotificationFilter = { id: "all" | NotificationKind; label: string };

export const NOTIFICATION_FILTERS = notificationsData.filters as NotificationFilter[];

/** Icon key + soft circle classes per notification type. Presentation config. */
export const NOTIFICATION_STYLES: Record<
  NotificationKind,
  { icon: string; circle: string; ring: string }
> = {
  orders: { icon: "shopping-bag", circle: "bg-brand-teal/12 text-brand-accent", ring: "bg-brand-teal" },
  payments: { icon: "credit-card", circle: "bg-brand-info/12 text-brand-info", ring: "bg-brand-info" },
  khata: { icon: "book-open", circle: "bg-brand-orange/12 text-brand-orange", ring: "bg-brand-orange" },
  promotions: { icon: "tag", circle: "bg-brand-cyan/15 text-brand-info", ring: "bg-brand-cyan" },
  system: { icon: "shield-check", circle: "bg-brand-navy/10 text-brand-navy", ring: "bg-brand-navy" },
};

type NotificationSeed = {
  id: string;
  kind: string;
  title: string;
  message: string;
  detail?: string;
  /** Relative age in the dataset so the feed always looks current. */
  hoursAgo: number;
  read: boolean;
  link?: string;
};

/**
 * Anchor relative ages to the top of the current hour so the timestamps are
 * identical during SSR and hydration (no hydration mismatch) while still
 * looking current.
 */
const NOW_ANCHOR = Math.floor(Date.now() / 3600_000) * 3600_000;

function toNotification(seed: NotificationSeed): CustomerNotification {
  const { hoursAgo, kind, detail, link, ...rest } = seed;
  return {
    ...rest,
    kind: kind as NotificationKind,
    createdAt: new Date(NOW_ANCHOR - hoursAgo * 3600_000).toISOString(),
    ...(detail ? { detail } : {}),
    ...(link ? { link: link as NotificationLink } : {}),
  };
}

export const MOCK_NOTIFICATIONS: CustomerNotification[] = (
  notificationsData.items as NotificationSeed[]
).map(toNotification);

/** Mock `GET /notifications`. */
export function fetchNotifications(): Promise<CustomerNotification[]> {
  return Promise.resolve(MOCK_NOTIFICATIONS);
}
