"use client";
/**
 * Frontend-only customer profile store (prototype, no backend).
 * Seeded from the mock account + mock JSON config, persisted in localStorage.
 * Swapping in an API later means replacing `read`/`persist` with fetch calls;
 * the `useCustomerProfile()` contract stays the same.
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
import { CHECKOUT, PROFILE } from "@/lib/catalog";
import { getAddress, getCurrentAccount, saveAddress, updateAccount } from "@/lib/mock-accounts";

const PROFILE_KEY = "retailai.customer-profile";

export type CustomerProfile = {
  fullName: string;
  email: string;
  phone: string;
  address: string;
};

type CustomerProfileContextValue = {
  profile: CustomerProfile;
  update: (patch: Partial<CustomerProfile>) => void;
};

const globalScope = globalThis as typeof globalThis & {
  __retailaiProfileContext?: Context<CustomerProfileContextValue | null>;
};
const ProfileContext =
  globalScope.__retailaiProfileContext ?? createContext<CustomerProfileContextValue | null>(null);
globalScope.__retailaiProfileContext = ProfileContext;

function defaults(): CustomerProfile {
  return {
    fullName: PROFILE.fallbackUser.fullName,
    email: PROFILE.fallbackUser.email,
    phone: PROFILE.fallbackUser.phone,
    address: CHECKOUT.address.value,
  };
}

function read(): CustomerProfile {
  const base = defaults();
  if (typeof window === "undefined") return base;
  const account = getCurrentAccount();
  const seeded: CustomerProfile = {
    fullName: account?.fullName ?? base.fullName,
    email: account?.email ?? base.email,
    phone: account?.phone ?? base.phone,
    address: getAddress() ?? base.address,
  };
  try {
    const raw = window.localStorage.getItem(PROFILE_KEY);
    const stored = raw ? (JSON.parse(raw) as Partial<CustomerProfile>) : {};
    return { ...seeded, ...stored };
  } catch {
    return seeded;
  }
}

export function CustomerProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<CustomerProfile>(defaults);

  // Hydrate after mount so SSR markup stays stable.
  useEffect(() => {
    setProfile(read());
  }, []);

  const update = useCallback((patch: Partial<CustomerProfile>) => {
    setProfile((prev) => {
      const next = { ...prev, ...patch };
      try {
        window.localStorage.setItem(PROFILE_KEY, JSON.stringify(next));
      } catch {
        /* storage unavailable in this prototype */
      }
      if (patch.address !== undefined) saveAddress(next.address);
      if (prev.email) {
        updateAccount(prev.email, {
          fullName: next.fullName,
          email: next.email,
          phone: next.phone,
        });
      }
      return next;
    });
  }, []);

  const value = useMemo<CustomerProfileContextValue>(
    () => ({ profile, update }),
    [profile, update],
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useCustomerProfile(): CustomerProfileContextValue {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error("useCustomerProfile must be used within a CustomerProfileProvider");
  return ctx;
}
