"use client";
/**
 * Access context for the shared management dashboard.
 *
 * Components never read roles directly — they ask `can(module, action)`.
 * Backend authorization remains the source of truth; this only shapes the UI
 * (navigation, widgets, buttons) so an unauthorized user is never shown an
 * action they cannot complete.
 */
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  type Access,
  type ActionId,
  type ModuleId,
  can as canAccess,
  canAnyAction as canAnyActionOn,
} from "./permissions";
import { fetchCurrentAccess, readPreviewId, writePreviewId } from "./users-repo";

type AccessContextValue = {
  access: Access | null;
  /** Display name of the previewed user, null when acting as the real owner. */
  previewUserId: string | null;
  previewName: string | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
  setPreviewUserId: (id: string | null) => void;
  can: (moduleId: ModuleId, action?: ActionId) => boolean;
  canAnyAction: (moduleId: ModuleId) => boolean;
};

/** HMR-safe singleton so a hot update never creates a second context instance. */
const globalScope = globalThis as typeof globalThis & {
  __retailaiOwnerAccessContext?: ReturnType<typeof createContext<AccessContextValue | null>>;
};

const AccessContext =
  globalScope.__retailaiOwnerAccessContext ??
  (globalScope.__retailaiOwnerAccessContext = createContext<AccessContextValue | null>(null));

export function OwnerAccessProvider({ children }: { children: ReactNode }) {
  const [access, setAccess] = useState<Access | null>(null);
  const [previewUserId, setPreviewId] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState<string | null>(null);
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchCurrentAccess()
      .then((result) => {
        if (cancelled) return;
        setAccess({
          roleId: result.roleId,
          fullAccess: result.fullAccess,
          permissions: result.permissions,
        });
        setPreviewId(result.userId);
        setPreviewName(result.name);
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "Could not load your access.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [nonce]);

  useEffect(() => {
    setPreviewId(readPreviewId());
  }, []);

  const refetch = useCallback(() => setNonce((value) => value + 1), []);

  const setPreviewUserId = useCallback(
    (id: string | null) => {
      writePreviewId(id);
      refetch();
    },
    [refetch],
  );

  const value = useMemo<AccessContextValue>(
    () => ({
      access,
      previewUserId,
      previewName,
      isLoading,
      error,
      refetch,
      setPreviewUserId,
      can: (moduleId, action = "view") => canAccess(access, moduleId, action),
      canAnyAction: (moduleId) => canAnyActionOn(access, moduleId),
    }),
    [access, previewUserId, previewName, isLoading, error, refetch, setPreviewUserId],
  );

  return <AccessContext.Provider value={value}>{children}</AccessContext.Provider>;
}

export function useAccess(): AccessContextValue {
  const context = useContext(AccessContext);
  if (!context) throw new Error("useAccess must be used within an OwnerAccessProvider");
  return context;
}

/** Declarative gate: renders children only when the permission is granted. */
export function Can({
  module: moduleId,
  action = "view",
  fallback = null,
  children,
}: {
  module: ModuleId;
  action?: ActionId;
  fallback?: ReactNode;
  children: ReactNode;
}) {
  const { can } = useAccess();
  return <>{can(moduleId, action) ? children : fallback}</>;
}
