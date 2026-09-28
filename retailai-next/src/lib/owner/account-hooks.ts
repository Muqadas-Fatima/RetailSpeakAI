"use client";
/** Data hooks for the Owner Profile / Account page. API-ready, frontend only. */
import { useCallback, useEffect, useState } from "react";
import {
  type OwnerAccount,
  type PersonalInfoInput,
  fetchOwnerAccount,
  updatePersonalInfo,
} from "./account-repo";
import type { Resource } from "./types";

export function useOwnerAccount(): Resource<OwnerAccount | null> {
  const [data, setData] = useState<OwnerAccount | null>(null);
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchOwnerAccount()
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

/** Mutation wrapper for the personal-information form. */
export function useUpdatePersonalInfo() {
  const [isSaving, setSaving] = useState(false);

  const save = useCallback(async (input: PersonalInfoInput) => {
    setSaving(true);
    try {
      await updatePersonalInfo(input);
      return { success: true as const };
    } catch (cause: unknown) {
      return {
        success: false as const,
        error: cause instanceof Error ? cause.message : "Could not save changes",
      };
    } finally {
      setSaving(false);
    }
  }, []);

  return { save, isSaving };
}
