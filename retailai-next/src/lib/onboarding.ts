"use client";
/**
 * Centralized frontend-only onboarding flow state (prototype, no backend).
 *
 * The signup journey spans several screens (Sign Up → Give Location → Address
 * → Verify Email → Home). Instead of each screen hardcoding where to go next,
 * the flow is carried in a `?flow=signup` search param and the pending signup
 * details live here. Replacing this with a real session API later does not
 * require touching the screens.
 */

const PENDING_KEY = "retailai.pending-signup";

export type PendingSignup = { email: string; fullName: string };

/** Search shape shared by the onboarding screens. */
export type FlowSearch = { flow?: "signup" };

export function validateFlowSearch(search: Record<string, unknown>): FlowSearch {
  return search["flow"] === "signup" ? { flow: "signup" } : {};
}

export function isSignupFlow(search: FlowSearch): boolean {
  return search.flow === "signup";
}

export function setPendingSignup(pending: PendingSignup): void {
  try {
    window.localStorage.setItem(PENDING_KEY, JSON.stringify(pending));
  } catch {
    /* storage unavailable in this prototype */
  }
}

export function getPendingSignup(): PendingSignup | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PendingSignup>;
    if (typeof parsed?.email !== "string") return null;
    return { email: parsed.email, fullName: parsed.fullName ?? "" };
  } catch {
    return null;
  }
}

export function clearPendingSignup(): void {
  try {
    window.localStorage.removeItem(PENDING_KEY);
  } catch {
    /* storage unavailable in this prototype */
  }
}
