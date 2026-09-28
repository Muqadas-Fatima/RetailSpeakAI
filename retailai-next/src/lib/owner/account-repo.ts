"use client";
/**
 * Owner account repository — frontend only.
 * Every function here mirrors a future API endpoint. Swap the bodies for real
 * fetches / server functions later; the Profile page never changes.
 */

import accountData from "@/data/owner/account.json";

export type AccountStatus = "active" | "pending-verification" | "suspended";

/** Shape mirrors the future `GET /owner/account` response. */
export type OwnerAccount = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  /** Role is authentication-owned and always read-only in the UI. */
  role: string;
  storeName: string;
  status: AccountStatus | null;
  avatarUrl?: string | undefined;
};

export type PersonalInfoInput = {
  fullName: string;
  email: string;
  phone: string;
};

/** Simulated network latency so loading/skeleton states are exercised. */
const LATENCY = 420;
const wait = (ms: number = LATENCY) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Mock `GET /owner/account`. Data lives in `src/data/owner/account.json`. */
export async function fetchOwnerAccount(): Promise<OwnerAccount | null> {
  await wait();
  return accountData as OwnerAccount;
}

/** Mock `PATCH /owner/account` — resolves without persisting anything. */
export async function updatePersonalInfo(_input: PersonalInfoInput): Promise<{ ok: true }> {
  await wait(300);
  return { ok: true };
}

export const ACCOUNT_STATUS_META: Record<
  AccountStatus,
  { label: string; tone: "success" | "warning" | "critical" }
> = {
  active: { label: "Active", tone: "success" },
  "pending-verification": { label: "Pending Verification", tone: "warning" },
  suspended: { label: "Suspended", tone: "critical" },
};
