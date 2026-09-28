"use client";
/**
 * Frontend-only scheduled (pre-order) store. Demo rows come from
 * `src/data/pre-order.json`; orders scheduled in-session are persisted in
 * localStorage and merged on top. Swapping this for an API later only means
 * replacing the read/persist helpers — the hook contract stays the same.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type Context,
  type ReactNode,
} from "react";
import preOrderJson from "@/data/pre-order.json";
import type { OrderLine } from "@/lib/catalog";

const SCHEDULED_KEY = "retailai.scheduled-orders";
const DRAFT_KEY = "retailai.scheduled-draft";

export type ScheduleStatus = "upcoming" | "completed" | "cancelled";

export type PreOrderSlot = { id: string; label: string };
export type PreOrderTab = { id: string; label: string; status: ScheduleStatus };

export type ScheduledOrder = {
  id: string;
  /** yyyy-mm-dd */
  date: string;
  timeSlotId: string;
  windowId: string;
  notes?: string;
  address: string;
  items: OrderLine[];
  productIds: string[];
  total: number;
  status: ScheduleStatus;
  createdAt?: string;
};

export type ScheduleDraft = {
  date: string;
  timeSlotId: string;
  windowId: string;
  notes: string;
  /** Set when editing an existing scheduled order. */
  editingId?: string;
};

export const PRE_ORDER = preOrderJson as unknown as {
  orderIdPrefix: string;
  maxDaysAhead: number;
  timeSlots: PreOrderSlot[];
  windows: PreOrderSlot[];
  notesPlaceholder: string;
  tabs: PreOrderTab[];
  statusLabels: Record<ScheduleStatus, string>;
  demoOrders: ScheduledOrder[];
};

export const PRE_ORDER_TABS = PRE_ORDER.tabs;

export function getSlotLabel(id: string): string {
  return PRE_ORDER.timeSlots.find((slot) => slot.id === id)?.label ?? id;
}

export function getWindowLabel(id: string): string {
  return PRE_ORDER.windows.find((slot) => slot.id === id)?.label ?? id;
}

export function getScheduleStatusLabel(status: ScheduleStatus): string {
  return PRE_ORDER.statusLabels[status] ?? status;
}

/** Local (not UTC) yyyy-mm-dd for a date object. */
export function toDateInput(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function todayInput(): string {
  return toDateInput(new Date());
}

export function maxDateInput(): string {
  const date = new Date();
  date.setDate(date.getDate() + PRE_ORDER.maxDaysAhead);
  return toDateInput(date);
}

export function formatScheduleDate(value: string): string {
  const [year, month, day] = value.split("-").map((part) => Number.parseInt(part, 10));
  if (!year || !month || !day) return value;
  return new Date(year, month - 1, day).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export type ScheduleOrderInput = {
  date: string;
  timeSlotId: string;
  windowId: string;
  notes?: string;
  address: string;
  items: OrderLine[];
  productIds: string[];
  total: number;
};

type ScheduledOrdersContextValue = {
  /** Session-scheduled orders first, then the demo rows. */
  scheduled: ScheduledOrder[];
  draft: ScheduleDraft | null;
  setDraft: (draft: ScheduleDraft | null) => void;
  getScheduled: (id: string | undefined) => ScheduledOrder | undefined;
  schedule: (input: ScheduleOrderInput) => ScheduledOrder;
  updateSchedule: (id: string, patch: Partial<ScheduledOrder>) => void;
  cancelSchedule: (id: string) => void;
};

const scope = globalThis as typeof globalThis & {
  __retailaiScheduledContext?: Context<ScheduledOrdersContextValue | null>;
};
const ScheduledContext =
  scope.__retailaiScheduledContext ?? createContext<ScheduledOrdersContextValue | null>(null);
scope.__retailaiScheduledContext = ScheduledContext;

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable in this prototype */
  }
}

function nextScheduleId(existing: ScheduledOrder[]): string {
  const numbers = [...existing, ...PRE_ORDER.demoOrders]
    .map((order) => Number.parseInt(order.id.replace(/\D/g, ""), 10))
    .filter((value) => Number.isFinite(value));
  const next = (numbers.length ? Math.max(...numbers) : 20480) + 1;
  return `${PRE_ORDER.orderIdPrefix}${next}`;
}

export function ScheduledOrdersProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<ScheduledOrder[]>([]);
  const [draft, setDraftState] = useState<ScheduleDraft | null>(null);

  // Hydrate after mount so SSR markup stays stable.
  useEffect(() => {
    setSession(readJson<ScheduledOrder[]>(SCHEDULED_KEY, []));
    setDraftState(readJson<ScheduleDraft | null>(DRAFT_KEY, null));
  }, []);

  const persist = useCallback((next: ScheduledOrder[]) => {
    setSession(next);
    writeJson(SCHEDULED_KEY, next);
  }, []);

  const setDraft = useCallback((next: ScheduleDraft | null) => {
    setDraftState(next);
    writeJson(DRAFT_KEY, next);
  }, []);

  const value = useMemo<ScheduledOrdersContextValue>(() => {
    const demo = PRE_ORDER.demoOrders.filter(
      (order) => !session.some((entry) => entry.id === order.id),
    );
    const scheduled = [...session, ...demo];

    return {
      scheduled,
      draft,
      setDraft,
      getScheduled: (id) => (id ? scheduled.find((order) => order.id === id) : undefined),
      schedule: (input) => {
        const order: ScheduledOrder = {
          id: nextScheduleId(session),
          date: input.date,
          timeSlotId: input.timeSlotId,
          windowId: input.windowId,
          address: input.address,
          items: input.items,
          productIds: input.productIds,
          total: input.total,
          status: "upcoming",
          createdAt: new Date().toISOString(),
          ...(input.notes ? { notes: input.notes } : {}),
        };
        persist([order, ...session]);
        return order;
      },
      updateSchedule: (id, patch) => {
        const existing = scheduled.find((order) => order.id === id);
        if (!existing) return;
        const merged = { ...existing, ...patch };
        persist(
          session.some((order) => order.id === id)
            ? session.map((order) => (order.id === id ? merged : order))
            : [merged, ...session],
        );
      },
      cancelSchedule: (id) => {
        const existing = scheduled.find((order) => order.id === id);
        if (!existing) return;
        const cancelled: ScheduledOrder = { ...existing, status: "cancelled" };
        persist(
          session.some((order) => order.id === id)
            ? session.map((order) => (order.id === id ? cancelled : order))
            : [cancelled, ...session],
        );
      },
    };
  }, [session, draft, persist, setDraft]);

  return <ScheduledContext.Provider value={value}>{children}</ScheduledContext.Provider>;
}

export function useScheduledOrders(): ScheduledOrdersContextValue {
  const ctx = useContext(ScheduledContext);
  if (!ctx)
    throw new Error("useScheduledOrders must be used within a ScheduledOrdersProvider");
  return ctx;
}
