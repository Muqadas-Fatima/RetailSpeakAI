"use client";

import { Link, useParams } from "@/lib/router-compat";import { ArrowLeft, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { ConfirmDialog, OwnerButton } from "@/components/owner/confirm-dialog";
import {
  Avatar,
  Panel,
  PanelBody,
  PanelHeader,
  ResourceState,
  SkeletonRows,
  StatusPill,
} from "@/components/owner/primitives";
import { useAccess } from "@/lib/owner/access";
import { formatRelativeTime } from "@/lib/owner/format";
import {
  PERMISSION_MODULES,
  actionLabel,
  permissionKey,
  roleLabel,
  summarisePermissions,
} from "@/lib/owner/permissions";
import { useManagedUser } from "@/lib/owner/users-hooks";



function UserDetailPage() {
  const { userId } = useParams();
  const { can } = useAccess();
  const { data, isLoading, error, refetch, setStatus } = useManagedUser(userId);
  const [pending, setPending] = useState<"inactive" | "active" | null>(null);
  const [busy, setBusy] = useState(false);
  const canEdit = can("users", "edit");

  const confirm = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      await setStatus(pending);
      toast.success(pending === "inactive" ? "User deactivated" : "User reactivated");
      setPending(null);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Could not update this user.");
    } finally {
      setBusy(false);
    }
  };

  const summary = summarisePermissions(data?.permissions ?? []);

  return (
    <div className="space-y-5">
      <Link
        to="/owner/users"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-accent hover:underline"
      >
        <ArrowLeft className="h-4 w-4 rtl:-scale-x-100" /> Back to Users &amp; Permissions
      </Link>

      <Panel>
        <PanelHeader title="User details" description="Read-only account and access summary" />
        <PanelBody>
          <ResourceState
            isLoading={isLoading}
            error={error}
            isEmpty={!data}
            onRetry={refetch}
            emptyTitle="User not found"
            emptyDescription="This account may have been removed."
            skeleton={<SkeletonRows rows={5} />}
          >
            {data ? (
              <div className="space-y-5">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 sm:flex sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar name={data.name} src={data.avatarUrl} className="h-12 w-12" />
                    <div className="min-w-0">
                      <p className="truncate text-base font-bold text-brand-navy-deep ">
                        {data.name}
                      </p>
                      <p className="truncate text-xs text-brand-secondary-text ">
                        {data.email ?? data.phone ?? "—"}
                      </p>
                    </div>
                  </div>
                  <StatusPill
                    label={data.status}
                    tone={
                      data.status === "active"
                        ? "success"
                        : data.status === "invited"
                          ? "info"
                          : "neutral"
                    }
                  />
                </div>

                <dl className="grid gap-3 sm:grid-cols-3">
                  <Detail label="Role" value={roleLabel(data.roleId)} />
                  <Detail
                    label="Last active"
                    value={formatRelativeTime(data.lastActiveAt, "Never")}
                  />
                  <Detail label="Permission summary" value={summary.label} />
                </dl>

                <section className="space-y-2.5">
                  <h2 className="text-sm font-bold text-brand-navy-deep ">Granted access</h2>
                  {data.permissions.length === 0 ? (
                    <p className="rounded-xl bg-brand-surface-2 px-3.5 py-3 text-xs text-brand-secondary-text ">
                      No modules granted yet. This user sees an empty dashboard until permissions
                      are assigned.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {PERMISSION_MODULES.map((module) => {
                        const granted = module.actions.filter((action) =>
                          data.permissions.includes(permissionKey(module.id, action)),
                        );
                        if (granted.length === 0) return null;
                        return (
                          <li
                            key={module.id}
                            className="grid gap-1.5 rounded-xl border border-brand-border-subtle px-3.5 py-2.5 sm:grid-cols-[200px_minmax(0,1fr)] sm:items-center"
                          >
                            <span className="text-sm font-semibold text-brand-navy-deep ">
                              {module.label}
                            </span>
                            <span className="flex flex-wrap gap-1.5">
                              {granted.map((action) => (
                                <StatusPill
                                  key={action}
                                  label={actionLabel(action)}
                                  tone="success"
                                />
                              ))}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>

                {canEdit ? (
                  <div className="flex flex-col gap-2 border-t border-brand-border-subtle pt-4 sm:flex-row">
                    <Link
                      to="/owner/users/$userId/permissions"
                      params={{ userId: data.id }}
                      className="bg-brand-gradient inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan"
                    >
                      <ShieldCheck className="h-4 w-4" /> Edit Permissions
                    </Link>
                    {data.status === "inactive" ? (
                      <OwnerButton variant="secondary" onClick={() => setPending("active")}>
                        Reactivate user
                      </OwnerButton>
                    ) : (
                      <OwnerButton variant="secondary" onClick={() => setPending("inactive")}>
                        Deactivate user
                      </OwnerButton>
                    )}
                  </div>
                ) : null}
              </div>
            ) : null}
          </ResourceState>
        </PanelBody>
      </Panel>

      <ConfirmDialog
        open={pending !== null}
        title={pending === "inactive" ? "Deactivate this user?" : "Reactivate this user?"}
        message={
          pending === "inactive"
            ? "Dashboard access is revoked immediately. Assigned permissions are kept for later reactivation."
            : "The user regains dashboard access with their previously assigned permissions."
        }
        confirmLabel={pending === "inactive" ? "Deactivate" : "Reactivate"}
        tone={pending === "inactive" ? "danger" : "primary"}
        loading={busy}
        onCancel={() => setPending(null)}
        onConfirm={confirm}
      />
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-brand-surface-2 px-3.5 py-3 ">
      <dt className="text-[11px] font-bold uppercase tracking-wide text-brand-muted">{label}</dt>
      <dd className="mt-0.5 truncate text-sm font-semibold text-brand-navy-deep ">{value}</dd>
    </div>
  );
}

export default UserDetailPage;
