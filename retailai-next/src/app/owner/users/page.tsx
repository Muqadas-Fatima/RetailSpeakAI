"use client";

import { Eye, Plus, ShieldCheck, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog, OwnerButton } from "@/components/owner/confirm-dialog";
import { Panel, PanelBody, PanelHeader, StatusPill } from "@/components/owner/primitives";
import { UserTable } from "@/components/owner/user-table";
import { AddUserModal } from "@/components/owner/user-form-modal";
import { useAccess } from "@/lib/owner/access";
import { MANAGEMENT_ROLES, roleLabel } from "@/lib/owner/permissions";
import { useManagedUsers } from "@/lib/owner/users-hooks";
import type { ManagedUser } from "@/lib/owner/users-repo";
import { cn } from "@/lib/utils";



type RoleFilter = "all" | string;

function UsersPage() {
  const { can, previewUserId, setPreviewUserId } = useAccess();
  const { data, isLoading, error, refetch, addUser, setStatus } = useManagedUsers();
  const [addOpen, setAddOpen] = useState(false);
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [search, setSearch] = useState("");
  const [pending, setPending] = useState<{ user: ManagedUser; next: "inactive" | "active" } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);

  const canView = can("users", "view");
  const canCreate = can("users", "create");
  const canEdit = can("users", "edit");

  const users = useMemo(() => {
    const list = data ?? [];
    const query = search.trim().toLowerCase();
    return list.filter((user) => {
      const matchesRole = roleFilter === "all" || user.roleId === roleFilter;
      const matchesQuery =
        query === "" ||
        [user.name, user.email ?? "", user.phone ?? ""].some((value) =>
          value.toLowerCase().includes(query),
        );
      return matchesRole && matchesQuery;
    });
  }, [data, roleFilter, search]);

  if (!canView) {
    return (
      <Panel>
        <PanelBody className="flex flex-col items-center gap-2 py-10 text-center">
          <span className="grid h-11 w-11 place-items-center rounded-full bg-brand-surface-2 text-brand-secondary-text ">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <h1 className="text-base font-bold text-brand-navy-deep ">
            You don't have access to Users & Permissions
          </h1>
          <p className="max-w-sm text-sm text-brand-secondary-text ">
            Ask the owner to grant you View access for this module. Authorization is always
            confirmed on the server.
          </p>
        </PanelBody>
      </Panel>
    );
  }

  const confirmStatus = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      await setStatus(pending.user.id, pending.next);
      toast.success(
        pending.next === "inactive"
          ? `${pending.user.name} was deactivated`
          : `${pending.user.name} was reactivated`,
      );
      setPending(null);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Could not update this user.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 sm:flex sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-black text-brand-navy-deep sm:text-2xl">
            Users &amp; Permissions
          </h1>
          <p className="mt-0.5 text-xs text-brand-secondary-text sm:text-sm">
            One dashboard, access decided entirely by permissions.
          </p>
        </div>
        {canCreate ? (
          <OwnerButton onClick={() => setAddOpen(true)} className="shrink-0">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Add User</span>
            <span className="sm:hidden">Add</span>
          </OwnerButton>
        ) : null}
      </header>

      <Panel>
        <PanelHeader title="Team accounts" description="Co-owners, managers and future staff roles">
          <span className="hidden items-center gap-1.5 text-xs font-semibold text-brand-secondary-text sm:flex">
            <Users className="h-3.5 w-3.5" />
            {(data ?? []).length} total
          </span>
        </PanelHeader>
        <PanelBody className="space-y-4">
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name, email or phone"
              aria-label="Search users"
              className="w-full rounded-xl border border-brand-border bg-white px-3.5 py-2.5 text-sm text-brand-navy-deep outline-none transition-colors placeholder:text-brand-muted focus:border-brand-teal sm:max-w-xs"
            />
            <div className="flex flex-wrap gap-1.5">
              <FilterChip
                label="All roles"
                active={roleFilter === "all"}
                onClick={() => setRoleFilter("all")}
              />
              {MANAGEMENT_ROLES.filter((role) => role.assignable).map((role) => (
                <FilterChip
                  key={role.id}
                  label={role.label}
                  active={roleFilter === role.id}
                  onClick={() => setRoleFilter(role.id)}
                />
              ))}
            </div>
          </div>

          <UserTable
            users={users}
            isLoading={isLoading}
            error={error}
            onRetry={refetch}
            actions={{
              canEdit,
              onDeactivate: (user) => setPending({ user, next: "inactive" }),
              onReactivate: (user) => setPending({ user, next: "active" }),
            }}
          />
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader
          title="Preview the dashboard"
          description="See exactly what a team member sees, driven by their permissions"
        />
        <PanelBody className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <FilterChip
              label="Acting as Owner"
              active={!previewUserId}
              onClick={() => setPreviewUserId(null)}
            />
            {(data ?? []).map((user) => (
              <FilterChip
                key={user.id}
                label={`${user.name} · ${roleLabel(user.roleId)}`}
                active={previewUserId === user.id}
                onClick={() => setPreviewUserId(user.id)}
              />
            ))}
          </div>
          {previewUserId ? (
            <p className="flex items-center gap-2 text-xs font-semibold text-brand-accent">
              <Eye className="h-3.5 w-3.5" />
              Navigation, widgets and actions now reflect this user's permissions.
            </p>
          ) : (
            <p className="text-xs text-brand-secondary-text ">
              Owner accounts always have full access. Select a team member to preview their view.
            </p>
          )}
          {(data ?? []).length === 0 ? (
            <StatusPill label="Add a user to preview their access" tone="neutral" />
          ) : null}
        </PanelBody>
      </Panel>

      <AddUserModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onDependencyNote={(message) => toast.info(message)}
        onSubmit={async (input) => {
          await addUser(input);
          toast.success(`${input.name} was invited as ${roleLabel(input.roleId)}`);
        }}
      />

      <ConfirmDialog
        open={pending !== null}
        title={pending?.next === "inactive" ? "Deactivate this user?" : "Reactivate this user?"}
        message={
          pending?.next === "inactive"
            ? `${pending?.user.name ?? "This user"} will immediately lose dashboard access. Their permissions are kept and restored on reactivation.`
            : `${pending?.user.name ?? "This user"} will regain dashboard access with their previously assigned permissions.`
        }
        confirmLabel={pending?.next === "inactive" ? "Deactivate" : "Reactivate"}
        tone={pending?.next === "inactive" ? "danger" : "primary"}
        loading={busy}
        onCancel={() => setPending(null)}
        onConfirm={confirmStatus}
      />
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "min-h-9 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan",
        active
          ? "border-brand-teal bg-brand-teal/12 text-brand-accent"
          : "border-brand-border bg-white text-brand-secondary-text hover:border-brand-teal/40 ",
      )}
    >
      {label}
    </button>
  );
}

export default UsersPage;
