"use client";
/** Frontend-only data container hooks for the Store Settings page. */
import { useCallback, useEffect, useState } from "react";
import {
  EMPTY_STORE_SETTINGS,
  type StoreSettings,
  fetchStoreSettings,
  saveStoreSettings,
} from "./settings-repo";
import type { Resource } from "./types";

export function useStoreSettings(): Resource<StoreSettings> {
  const [data, setData] = useState<StoreSettings | null>(null);
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchStoreSettings()
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
  }, [nonce]);

  const refetch = useCallback(() => setNonce((value) => value + 1), []);
  return { data, isLoading, error, refetch };
}

/** Mutation seam shared by every settings card. */
export function useSaveStoreSettings() {
  const [isSaving, setSaving] = useState(false);

  const save = useCallback(async (settings: StoreSettings) => {
    setSaving(true);
    try {
      await saveStoreSettings(settings);
      return { success: true as const };
    } catch (cause: unknown) {
      return {
        success: false as const,
        error: cause instanceof Error ? cause.message : "Could not save settings",
      };
    } finally {
      setSaving(false);
    }
  }, []);

  return { save, isSaving };
}

export { EMPTY_STORE_SETTINGS };
