"use client";
/**
 * Data hooks for Users & Permissions. Components stay free of fetching logic;
 * swapping the repository for real endpoints does not touch the UI.
 */
import { useCallback, useEffect, useState } from "react";
import type { PermissionKey } from "./permissions";
import {
  type CreateUserInput,
  type ManagedUser,
  type UserStatus,
  createUser,
  getUser,
  listUsers,
  updateUserPermissions,
  updateUserStatus,
} from "./users-repo";

export function useManagedUsers() {
  const [data, setData] = useState<ManagedUser[] | null>(null);
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    listUsers()
      .then((users) => {
        if (!cancelled) setData(users);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Could not load users.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => load(), [load]);

  const refetch = useCallback(() => {
    load();
  }, [load]);

  const addUser = useCallback(
    async (input: CreateUserInput) => {
      const user = await createUser(input);
      refetch();
      return user;
    },
    [refetch],
  );

  const setStatus = useCallback(
    async (id: string, status: UserStatus) => {
      const user = await updateUserStatus(id, status);
      refetch();
      return user;
    },
    [refetch],
  );

  return { data, isLoading, error, refetch, addUser, setStatus };
}

export function useManagedUser(id: string) {
  const [data, setData] = useState<ManagedUser | null>(null);
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getUser(id)
      .then((user) => {
        if (cancelled) return;
        if (!user) setError("This user could not be found.");
        setData(user);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Could not load user.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, nonce]);

  const refetch = useCallback(() => setNonce((value) => value + 1), []);

  const savePermissions = useCallback(
    async (permissions: PermissionKey[]) => {
      const user = await updateUserPermissions(id, permissions);
      setData(user);
      return user;
    },
    [id],
  );

  const setStatus = useCallback(
    async (status: UserStatus) => {
      const user = await updateUserStatus(id, status);
      setData(user);
      return user;
    },
    [id],
  );

  return { data, isLoading, error, refetch, savePermissions, setStatus };
}
