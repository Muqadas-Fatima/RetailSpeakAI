"use client";
/** Frontend-only cart store persisted in localStorage (prototype, no backend). */
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
import { calculateTotals, getProduct } from "@/lib/catalog";

const CART_KEY = "retailai.cart";

export type CartLine = { id: string; qty: number; options?: string[] | undefined };

type CartContextValue = {
  lines: CartLine[];
  count: number;
  subtotal: number;
  deliveryFee: number;
  discount: number;
  total: number;
  add: (id: string, qty?: number, options?: string[]) => void;
  setQty: (id: string, qty: number) => void;
  remove: (id: string) => void;
  clear: () => void;
  replaceWith: (ids: string[]) => void;
};

// Keep one context instance across HMR module duplicates so the provider is always found.
const globalScope = globalThis as typeof globalThis & {
  __retailaiCartContext?: Context<CartContextValue | null>;
};
const CartContext =
  globalScope.__retailaiCartContext ?? createContext<CartContextValue | null>(null);
globalScope.__retailaiCartContext = CartContext;

function readCart(): CartLine[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CART_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as CartLine[]) : [];
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);

  // Hydrate after mount so SSR markup stays stable.
  useEffect(() => {
    setLines(readCart());
  }, []);

  const persist = useCallback((next: CartLine[]) => {
    setLines(next);
    try {
      window.localStorage.setItem(CART_KEY, JSON.stringify(next));
    } catch {
      /* storage unavailable in this prototype */
    }
  }, []);

  const value = useMemo<CartContextValue>(() => {
    const subtotal = lines.reduce((sum, line) => {
      const product = getProduct(line.id);
      return sum + (product ? product.price * line.qty : 0);
    }, 0);
    const { deliveryFee, discount, total } = calculateTotals(subtotal, lines.length > 0);

    return {
      lines,
      count: lines.reduce((sum, line) => sum + line.qty, 0),
      subtotal,
      deliveryFee,
      discount,
      total,
      add: (id, qty = 1, options) => {
        const existing = lines.find((line) => line.id === id);
        persist(
          existing
            ? lines.map((line) =>
                line.id === id
                  ? { ...line, qty: line.qty + qty, options: options ?? line.options }
                  : line,
              )
            : [...lines, { id, qty, options }],
        );
      },
      setQty: (id, qty) =>
        persist(
          qty <= 0
            ? lines.filter((line) => line.id !== id)
            : lines.map((line) => (line.id === id ? { ...line, qty } : line)),
        ),
      remove: (id) => persist(lines.filter((line) => line.id !== id)),
      clear: () => persist([]),
      replaceWith: (ids) => {
        const next: CartLine[] = [];
        ids.forEach((id) => {
          const existing = next.find((line) => line.id === id);
          if (existing) existing.qty += 1;
          else next.push({ id, qty: 1 });
        });
        persist(next);
      },
    };
  }, [lines, persist]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used within a CartProvider");
  return context;
}
