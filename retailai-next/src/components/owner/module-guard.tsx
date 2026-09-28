"use client";
import { Link } from "@/lib/router-compat";
import { ShieldOff } from "lucide-react";
import type { ReactNode } from "react";
import { Panel, PanelBody, SkeletonBlock } from "@/components/owner/primitives";
import { useAccess } from "@/lib/owner/access";
import { type ModuleId, moduleLabel } from "@/lib/owner/permissions";

/**
 * Page-level gate for the shared management dashboard. Inaccessible pages are
 * never rendered, but backend authorization remains the source of truth.
 */
export function ModuleGuard({
  module: moduleId,
  children,
}: {
  module?: ModuleId | undefined;
  children: ReactNode;
}) {
  const { can, isLoading, error, refetch } = useAccess();

  if (isLoading) {
    return (
      <div className="space-y-4" role="status" aria-label="Loading dashboard">
        <SkeletonBlock className="h-9 w-56" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <SkeletonBlock key={index} className="h-28 rounded-2xl" />
          ))}
        </div>
        <SkeletonBlock className="h-72 rounded-2xl" />
      </div>
    );
  }

  if (error) {
    return (
      <Panel>
        <PanelBody className="flex flex-col items-center gap-2 py-10 text-center">
          <h1 className="text-base font-bold text-brand-navy-deep ">Couldn't load your access</h1>
          <p className="max-w-sm text-sm text-brand-secondary-text ">{error}</p>
          <button
            type="button"
            onClick={refetch}
            className="bg-brand-gradient rounded-xl px-4 py-2.5 text-sm font-semibold text-white"
          >
            Try again
          </button>
        </PanelBody>
      </Panel>
    );
  }

  if (moduleId && !can(moduleId, "view")) {
    return (
      <Panel>
        <PanelBody className="flex flex-col items-center gap-2 py-12 text-center">
          <span className="grid h-11 w-11 place-items-center rounded-full bg-brand-surface-2 text-brand-secondary-text ">
            <ShieldOff className="h-5 w-5" />
          </span>
          <h1 className="text-base font-bold text-brand-navy-deep ">
            No access to {moduleLabel(moduleId)}
          </h1>
          <p className="max-w-sm text-sm text-brand-secondary-text ">
            Your account does not have View permission for this module. Ask the owner to grant it.
          </p>
          <Link
            to="/owner"
            className="bg-brand-gradient mt-1 rounded-xl px-4 py-2.5 text-sm font-semibold text-white"
          >
            Go to dashboard
          </Link>
        </PanelBody>
      </Panel>
    );
  }

  return <>{children}</>;
}
