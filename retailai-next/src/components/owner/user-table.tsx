"use client";
import { Link } from "@/lib/router-compat";
import { Eye, ShieldCheck, UserCheck, UserX } from "lucide-react";
import { Avatar, ResourceState, StatusPill, Th } from "@/components/owner/primitives";
import { formatRelativeTime } from "@/lib/owner/format";
import { roleLabel, summarisePermissions } from "@/lib/owner/permissions";
import type { ManagedUser, UserStatus } from "@/lib/owner/users-repo";
import { cn } from "@/lib/utils";

const STATUS_TONE: Record<UserStatus, "success" | "info" | "neutral"> = {
  active: "success",
  invited: "info",
  inactive: "neutral",
};

export type UserRowActions = {
  /** Whether the signed-in user may change access/status. */
  canEdit: boolean;
  onDeactivate: (user: ManagedUser) => void;
  onReactivate: (user: ManagedUser) => void;
};

/**
 * Responsive users table: full data table from `lg`, action-preserving cards on
 * mobile and tablet. Rows are pure props — any API payload can drive it.
 */
export function UserTable({
  users,
  isLoading,
  error,
  onRetry,
  actions,
  emptyAction,
}: {
  users: ManagedUser[];
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  actions: UserRowActions;
  emptyAction?: React.ReactNode;
}) {
  return (
    <ResourceState
      isLoading={isLoading}
      error={error}
      isEmpty={users.length === 0}
      onRetry={onRetry}
      emptyTitle="No team members yet"
      emptyDescription="Invite a co-owner or manager and grant them the modules they need."
    >
      <>
        {/* Desktop table */}
        <div className="scroll-rail hidden overflow-x-auto lg:block">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr>
                <Th>User</Th>
                <Th>Email / Phone</Th>
                <Th>Role</Th>
                <Th>Status</Th>
                <Th>Permissions</Th>
                <Th>Last Active</Th>
                <Th className="text-end">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const summary = summarisePermissions(user.permissions);
                return (
                  <tr key={user.id} className="border-t border-brand-border-subtle ">
                    <td className="px-3 py-3">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <Avatar name={user.name} src={user.avatarUrl} className="h-9 w-9" />
                        <span className="truncate text-sm font-semibold text-brand-navy-deep ">
                          {user.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-sm text-brand-secondary-text ">
                      <span className="block truncate">{user.email ?? "—"}</span>
                      <span className="block truncate text-xs">{user.phone ?? ""}</span>
                    </td>
                    <td className="px-3 py-3">
                      <StatusPill label={roleLabel(user.roleId)} tone="info" />
                    </td>
                    <td className="px-3 py-3">
                      <StatusPill label={user.status} tone={STATUS_TONE[user.status]} />
                    </td>
                    <td className="px-3 py-3 text-sm text-brand-secondary-text ">
                      {summary.label}
                    </td>
                    <td className="px-3 py-3 text-sm text-brand-secondary-text ">
                      {formatRelativeTime(user.lastActiveAt, "Never")}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <RowActions user={user} actions={actions} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile + tablet cards */}
        <ul className="space-y-3 lg:hidden">
          {users.map((user) => {
            const summary = summarisePermissions(user.permissions);
            return (
              <li key={user.id} className="rounded-2xl border border-brand-border-subtle p-3.5 ">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <Avatar name={user.name} src={user.avatarUrl} className="h-10 w-10" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-brand-navy-deep ">
                        {user.name}
                      </p>
                      <p className="truncate text-xs text-brand-secondary-text ">
                        {user.email ?? user.phone ?? "—"}
                      </p>
                    </div>
                  </div>
                  <StatusPill label={user.status} tone={STATUS_TONE[user.status]} />
                </div>

                <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <Field label="Role" value={roleLabel(user.roleId)} />
                  <Field
                    label="Last active"
                    value={formatRelativeTime(user.lastActiveAt, "Never")}
                  />
                  <Field label="Permissions" value={summary.label} className="col-span-2" />
                </dl>

                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  <RowActions user={user} actions={actions} expanded />
                </div>
              </li>
            );
          })}
        </ul>

        {emptyAction}
      </>
    </ResourceState>
  );
}

function Field({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">
        {label}
      </dt>
      <dd className="truncate text-brand-navy-deep ">{value}</dd>
    </div>
  );
}

function RowActions({
  user,
  actions,
  expanded,
}: {
  user: ManagedUser;
  actions: UserRowActions;
  expanded?: boolean;
}) {
  const base =
    "inline-flex min-h-9 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan";
  const neutral = "border-brand-border bg-white text-brand-navy-deep hover:bg-brand-surface-2 ";

  return (
    <>
      <Link
        to="/owner/users/$userId"
        params={{ userId: user.id }}
        className={cn(base, neutral)}
        aria-label={`View ${user.name}`}
      >
        <Eye className="h-3.5 w-3.5" />
        {expanded ? "View" : <span className="sr-only">View</span>}
      </Link>

      {actions.canEdit ? (
        <>
          <Link
            to="/owner/users/$userId/permissions"
            params={{ userId: user.id }}
            className={cn(
              base,
              "border-transparent bg-brand-teal/12 text-brand-accent hover:bg-brand-teal/20",
            )}
            aria-label={`Edit permissions for ${user.name}`}
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            {expanded ? "Edit Permissions" : "Permissions"}
          </Link>

          {user.status === "inactive" ? (
            <button
              type="button"
              onClick={() => actions.onReactivate(user)}
              className={cn(base, neutral)}
            >
              <UserCheck className="h-3.5 w-3.5" />
              Reactivate
            </button>
          ) : (
            <button
              type="button"
              onClick={() => actions.onDeactivate(user)}
              className={cn(
                base,
                "border-destructive/25 bg-destructive/10 text-brand-danger hover:bg-destructive/15",
              )}
            >
              <UserX className="h-3.5 w-3.5" />
              Deactivate
            </button>
          )}
        </>
      ) : null}
    </>
  );
}
