"use client";
/** Frontend-only mock account store (prototype). No backend, no real security. */
export type MockAccount = {
  fullName: string;
  email: string;
  phone: string;
  gender: string;
  age: number;
  language: string;
  role: "customer";
  createdAt: string;
  password: string;
  notifications: {
    orderUpdates: boolean;
    promotions: boolean;
    newFeatures: boolean;
  };
  theme: "light" | "dark" | "system";
};

const ACCOUNTS_KEY = "retailai.mock-accounts";
const SESSION_KEY = "retailai.session";
const ADDRESS_KEY = "retailai.address";

export function getMockAccounts(): MockAccount[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(ACCOUNTS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as MockAccount[]) : [];
  } catch {
    return [];
  }
}

function saveMockAccounts(accounts: MockAccount[]) {
  try {
    window.localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
  } catch {
    /* storage unavailable in this prototype */
  }
}

export function mockAccountExists(email: string): boolean {
  const target = email.trim().toLowerCase();
  return getMockAccounts().some((a) => a.email.toLowerCase() === target);
}

export function addMockAccount(input: {
  fullName: string;
  email: string;
  phone: string;
  gender: string;
  age: number;
  language: string;
  password?: string;
}) {
  const account: MockAccount = {
    fullName: input.fullName.trim(),
    email: input.email.trim(),
    phone: input.phone.trim(),
    gender: input.gender,
    age: input.age,
    language: input.language,
    role: "customer",
    createdAt: new Date().toISOString(),
    password: input.password?.trim() || "123456",
    notifications: {
      orderUpdates: true,
      promotions: true,
      newFeatures: true,
    },
    theme: "system",
  };
  const next = [...getMockAccounts(), account];
  saveMockAccounts(next);
  return account;
}

export type SessionRole = "customer" | "owner";

export type Session = {
  email: string;
  role: SessionRole;
} | null;

/**
 * Prototype-only owner credentials (frontend mock, no backend).
 * A real deployment replaces this with a server-side auth check.
 */
export const OWNER_CREDENTIALS = {
  email: "mhsh@gmail.com",
  password: "Mhsh_1234",
};

export function isOwnerCredentials(username: string, password: string): boolean {
  return (
    username.trim().toLowerCase() === OWNER_CREDENTIALS.email &&
    password === OWNER_CREDENTIALS.password
  );
}

export function getSession(): Session {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.email === "string") {
      return { email: parsed.email, role: parsed.role === "owner" ? "owner" : "customer" };
    }
    return null;
  } catch {
    return null;
  }
}

export function setSession(email: string, role: SessionRole = "customer") {
  try {
    window.localStorage.setItem(SESSION_KEY, JSON.stringify({ email, role }));
  } catch {
    /* storage unavailable in this prototype */
  }
}

export function isOwnerSession(): boolean {
  return getSession()?.role === "owner";
}

export function clearSession() {
  try {
    window.localStorage.removeItem(SESSION_KEY);
  } catch {
    /* storage unavailable in this prototype */
  }
}

export function getCurrentAccount(): MockAccount | null {
  const session = getSession();
  if (!session) return null;
  return (
    getMockAccounts().find((a) => a.email.toLowerCase() === session.email.toLowerCase()) || null
  );
}

export function updateAccount(email: string, patch: Partial<MockAccount>) {
  const accounts = getMockAccounts();
  const index = accounts.findIndex((a) => a.email.toLowerCase() === email.toLowerCase());
  if (index === -1) return null;
  const updated = { ...accounts[index], ...patch } as MockAccount;
  accounts[index] = updated;
  saveMockAccounts(accounts);
  return updated;
}

export function changePassword(
  email: string,
  currentPassword: string,
  newPassword: string,
): { success: boolean; error?: string } {
  const account = getMockAccounts().find((a) => a.email.toLowerCase() === email.toLowerCase());
  if (!account) return { success: false, error: "account_not_found" };
  if (account.password !== currentPassword.trim()) {
    return { success: false, error: "incorrect_current_password" };
  }
  updateAccount(email, { password: newPassword.trim() });
  return { success: true };
}

export function saveAddress(address: string) {
  try {
    window.localStorage.setItem(ADDRESS_KEY, address.trim());
  } catch {
    /* storage unavailable in this prototype */
  }
}

export function getAddress(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(ADDRESS_KEY);
  } catch {
    return null;
  }
}
