"use client";
/**
 * Frontend-only order store. Orders placed in-session are persisted in
 * localStorage and merged with the mock order history from JSON, so every
 * screen (confirmation, tracking, history, reorder) reads real state.
 * Swapping this for an API later only means replacing the read/write helpers.
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
import {
  CHECKOUT,
  ORDERS,
  TRACKING,
  getProduct,
  type Order,
  type OrderStatus,
} from "@/lib/catalog";
import type { CartLine } from "@/lib/cart";

const ORDERS_KEY = "retailai.orders";

export type PlaceOrderInput = {
  lines: CartLine[];
  total: number;
  paymentMethodId: string;
  instructions?: string;
};

type OrdersContextValue = {
  /** Session orders first, then the mock history. */
  orders: Order[];
  placedOrders: Order[];
  latestOrder: Order | undefined;
  getOrder: (id: string | undefined) => Order | undefined;
  placeOrder: (input: PlaceOrderInput) => Order;
  /** Stage index derived from elapsed time since the order was placed. */
  getStageIndex: (order: Order | undefined) => number;
  cancelOrder: (id: string) => void;
};

// Keep one context instance across HMR module duplicates so the provider is always found.
const ordersScope = globalThis as typeof globalThis & {
  __retailaiOrdersContext?: Context<OrdersContextValue | null>;
};
const OrdersContext =
  ordersScope.__retailaiOrdersContext ?? createContext<OrdersContextValue | null>(null);
ordersScope.__retailaiOrdersContext = OrdersContext;

function readOrders(): Order[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(ORDERS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as Order[]) : [];
  } catch {
    return [];
  }
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function nextOrderId(existing: Order[]): string {
  const numbers = [...existing, ...ORDERS]
    .map((order) => Number.parseInt(order.id.replace(/\D/g, ""), 10))
    .filter((value) => Number.isFinite(value));
  const next = (numbers.length ? Math.max(...numbers) : 10245) + 1;
  return `${CHECKOUT.orderIdPrefix}${next}`;
}

export function OrdersProvider({ children }: { children: ReactNode }) {
  const [placedOrders, setPlacedOrders] = useState<Order[]>([]);
  // Ticks once per second so time-driven tracking stages re-render.
  const [tick, setTick] = useState(0);

  useEffect(() => {
    setPlacedOrders(readOrders());
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setTick((value) => value + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  const persist = useCallback((next: Order[]) => {
    setPlacedOrders(next);
    try {
      window.localStorage.setItem(ORDERS_KEY, JSON.stringify(next));
    } catch {
      /* storage unavailable in this prototype */
    }
  }, []);

  const value = useMemo<OrdersContextValue>(() => {
    const stages = TRACKING.stages;

    const getStageIndex = (order: Order | undefined) => {
      if (!order) return 0;
      if (order.status === "delivered") return stages.length - 1;
      if (!order.placedAt) return Math.max(stages.length - 2, 0);
      const elapsed = (Date.now() - new Date(order.placedAt).getTime()) / 1000;
      let index = 0;
      stages.forEach((stage, i) => {
        if (elapsed >= stage.afterSeconds) index = i;
      });
      return index;
    };

    const decorate = (order: Order): Order => {
      const index = getStageIndex(order);
      const status: OrderStatus =
        order.status === "cancelled"
          ? "cancelled"
          : index >= stages.length - 1
            ? "delivered"
            : "active";
      return { ...order, status };
    };

    const decorated = placedOrders.map(decorate);
    const orders = [...decorated, ...ORDERS];

    return {
      orders,
      placedOrders: decorated,
      latestOrder: decorated[0] ?? ORDERS[0],
      getOrder: (id) => (id ? orders.find((order) => order.id === id) : orders[0]),
      getStageIndex,
      cancelOrder: (id) =>
        persist(
          placedOrders.map((order) =>
            order.id === id ? { ...order, status: "cancelled" as OrderStatus } : order,
          ),
        ),
      placeOrder: ({ lines, total, paymentMethodId, instructions }) => {
        const now = new Date();
        const order: Order = {
          id: nextOrderId(placedOrders),
          date: formatDate(now),
          items: lines.map((line) => ({
            name: getProduct(line.id)?.name ?? line.id,
            qty: line.qty,
          })),
          total,
          status: "active",
          productIds: lines.flatMap((line) => Array.from({ length: line.qty }, () => line.id)),
          placedAt: now.toISOString(),
          paymentMethodId,
          ...(instructions ? { instructions } : {}),
        };
        persist([order, ...placedOrders]);
        return order;
      },
    };
    // `tick` intentionally re-derives the time-based stage/status values.
  }, [placedOrders, persist, tick]);

  return <OrdersContext.Provider value={value}>{children}</OrdersContext.Provider>;
}

export function useOrders(): OrdersContextValue {
  const context = useContext(OrdersContext);
  if (!context) throw new Error("useOrders must be used within an OrdersProvider");
  return context;
}
