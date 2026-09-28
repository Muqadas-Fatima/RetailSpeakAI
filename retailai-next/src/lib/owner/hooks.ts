"use client";
/**
 * Data access layer for the Owner Portal.
 * Each hook mimics an API call (loading -> data | error) and returns the generic
 * `Resource` shape. Swap the body of each `load` function for a real fetch /
 * server function later; component code stays untouched.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { getCurrentAccount } from "@/lib/mock-accounts";
import {
  PLACEHOLDER_DASHBOARD,
  PLACEHOLDER_NOTIFICATIONS,
  placeholderForecast,
  placeholderSales,
} from "./placeholder-data";
import type {
  Forecast,
  ForecastHorizon,
  OwnerDashboard,
  OwnerNotification,
  OwnerProfile,
  Resource,
  SalesMetric,
  SalesRange,
  SalesSeries,
} from "./types";

/** Generic async resource driver shared by every owner hook. */
function useResource<T>(load: () => Promise<T>, deps: unknown[]): Resource<T> {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    load()
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Request failed");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  const refetch = useCallback(() => setNonce((value) => value + 1), []);
  return { data, isLoading, error, refetch };
}

/** Authenticated owner profile. Replace with the session/user API response. */
export function useOwnerProfile(): OwnerProfile {
  const [profile, setProfile] = useState<OwnerProfile>({
    name: "Owner",
    email: "",
    role: "Owner",
  });

  useEffect(() => {
    const account = getCurrentAccount();
    if (!account) return;
    setProfile({ name: account.fullName || "Owner", email: account.email, role: "Owner" });
  }, []);

  return profile;
}

export function useOwnerDashboard(): Resource<OwnerDashboard> {
  return useResource<OwnerDashboard>(async () => PLACEHOLDER_DASHBOARD, []);
}

export function useOwnerNotifications() {
  const resource = useResource<OwnerNotification[]>(async () => PLACEHOLDER_NOTIFICATIONS, []);
  const unreadCount = useMemo(
    () => (resource.data ?? []).filter((item) => !item.read).length,
    [resource.data],
  );
  return { ...resource, unreadCount };
}

export function useSalesSeries(range: SalesRange, metric: SalesMetric): Resource<SalesSeries> {
  return useResource<SalesSeries>(async () => placeholderSales(range, metric), [range, metric]);
}

export function useForecast(horizon: ForecastHorizon): Resource<Forecast> {
  return useResource<Forecast>(async () => placeholderForecast(horizon), [horizon]);
}

/** Time-of-day greeting derived from the client clock, never from mock data. */
export function useGreeting(): string {
  const [greeting, setGreeting] = useState("Welcome");
  useEffect(() => {
    const hour = new Date().getHours();
    setGreeting(hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening");
  }, []);
  return greeting;
}
