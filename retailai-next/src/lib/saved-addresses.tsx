"use client";
/**
 * Frontend-only saved-addresses store (prototype, no backend).
 * Multiple labeled addresses (Home, Office, Other) persisted in localStorage.
 * Swapping in an API later means replacing read/persist with fetch calls;
 * the useSavedAddresses() contract stays the same.
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
import { CHECKOUT } from "@/lib/catalog";
import { getAddress } from "@/lib/mock-accounts";

const ADDRESSES_KEY = "retailai.saved-addresses";

export type AddressLabel = "Home" | "Office" | "Other";

export type SavedAddress = {
  id: string;
  label: AddressLabel;
  /** Free-form street/area address text. */
  line: string;
};

const LABELS: AddressLabel[] = ["Home", "Office", "Other"];

const globalScope = globalThis as typeof globalThis & {
  __retailaiAddressesContext?: Context<SavedAddressesContextValue | null>;
};

type SavedAddressesContextValue = {
  addresses: SavedAddress[];
  addAddress: (label: AddressLabel, line: string) => void;
  removeAddress: (id: string) => void;
  updateAddress: (id: string, patch: Partial<Omit<SavedAddress, "id">>) => void;
};

const AddressesContext =
  globalScope.__retailaiAddressesContext ??
  createContext<SavedAddressesContextValue | null>(null);
globalScope.__retailaiAddressesContext = AddressesContext;

function defaults(): SavedAddress[] {
  // Seed from the legacy single-address store if present, else the checkout default.
  const existing = typeof window !== "undefined" ? getAddress() : null;
  const seed = existing || CHECKOUT.address.value;
  return [{ id: "seed-home", label: "Home", line: seed }];
}

function read(): SavedAddress[] {
  if (typeof window === "undefined") return defaults();
  try {
    const raw = window.localStorage.getItem(ADDRESSES_KEY);
    if (!raw) return defaults();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return defaults();
    return parsed as SavedAddress[];
  } catch {
    return defaults();
  }
}

function persist(list: SavedAddress[]) {
  try {
    window.localStorage.setItem(ADDRESSES_KEY, JSON.stringify(list));
  } catch {
    /* storage unavailable in this prototype */
  }
}

export function SavedAddressesProvider({ children }: { children: ReactNode }) {
  const [addresses, setAddresses] = useState<SavedAddress[]>(defaults);

  useEffect(() => {
    setAddresses(read());
  }, []);

  const addAddress = useCallback((label: AddressLabel, line: string) => {
    setAddresses((prev) => {
      const next = [
        ...prev,
        { id: `addr-${Date.now()}`, label, line: line.trim() },
      ];
      persist(next);
      return next;
    });
  }, []);

  const removeAddress = useCallback((id: string) => {
    setAddresses((prev) => {
      const next = prev.filter((a) => a.id !== id);
      persist(next);
      return next;
    });
  }, []);

  const updateAddress = useCallback(
    (id: string, patch: Partial<Omit<SavedAddress, "id">>) => {
      setAddresses((prev) => {
        const next = prev.map((a) => (a.id === id ? { ...a, ...patch } : a));
        persist(next);
        return next;
      });
    },
    [],
  );

  const value = useMemo<SavedAddressesContextValue>(
    () => ({ addresses, addAddress, removeAddress, updateAddress }),
    [addresses, addAddress, removeAddress, updateAddress],
  );

  return (
    <AddressesContext.Provider value={value}>
      {children}
    </AddressesContext.Provider>
  );
}

export function useSavedAddresses(): SavedAddressesContextValue {
  const ctx = useContext(AddressesContext);
  if (!ctx)
    throw new Error("useSavedAddresses must be used within a SavedAddressesProvider");
  return ctx;
}

export { LABELS };
