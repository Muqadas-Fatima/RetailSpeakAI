"use client";

import { Link, useNavigate, useParams } from "@/lib/router-compat";import { ArrowLeft, RotateCcw, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog, OwnerButton } from "@/components/owner/confirm-dialog";
import { PermissionMatrix } from "@/components/owner/permission-matrix";
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
import {
  type PermissionKey,
  findRole,
  roleLabel,
  samePermissions,
  summarisePermissions,
} from "@/lib/owner/permissions";
import { useManagedUser } from "@/lib/owner/users-hooks";



function EditPermissionsPage() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { can, refetch: refetchAccess } = useAccess();
  const { data, isLoading, error, refetch, savePermissions } = useManagedUser(userId);

  const [draft, setDraft] = useState<PermissionKey[]>([]);
  const [confirmSave, setConfirmSave] = useState(false);
  const [saving, setSaving] = useState(false);

  // Server response is the source of truth; the draft always resets to it.
  useEffect(() => {
    if (data) setDraft(data.permissions);
  }, [data]);

  const role = data ? findRole(data.roleId) : undefined;
  const readOnly = Boolean(role?.fullAccess) || !can("users", "edit");
  const dirty = data ? !samePermissions(draft, data.permissions) : false;
  const summary = useMemo(
    () => summarisePermissions(draft, role?.fullAccess ?? false),
    [draft, role],
  );

  const handleSave = async () => {
    setSaving(true);
    try {
      await savePermissions(draft);
      // Re-reads permissions from the repository response, never a local guess.
      refetch();
      refetchAccess();
      toast.success("Permissions saved");
      setConfirmSave(false);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Could not save permissions.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <Link
        to="/owner/users"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-accent hover:underline"
      >
        <ArrowLeft className="h-4 w-4 rtl:-scale-x-100" /> Back to Users &amp; Permissions
      </Link>

      <Panel>
        <PanelHeader
          title="Edit Permissions"
          description="Module and action level access for this account"
        >
          <span className="hidden text-xs font-semibold text-brand-accent sm:inline">
            {summary.label}
          </span>
        </PanelHeader>
        <PanelBody>
          <ResourceState
            isLoading={isLoading}
            error={error}
            isEmpty={!data}
            onRetry={refetch}
            emptyTitle="User not found"
            emptyDescription="This account may have been removed."
            skeleton={<SkeletonRows rows={6} />}
          >
            {data ? (
              <div className="space-y-5">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 rounded-2xl bg-brand-surface-2 p-3.5 sm:flex sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar name={data.name} src={data.avatarUrl} className="h-11 w-11" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-brand-navy-deep ">
                        {data.name}
                      </p>
                      <p className="truncate text-xs text-brand-secondary-text ">
                        {data.email ?? data.phone ?? "—"}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                    <StatusPill label={roleLabel(data.roleId)} tone="info" />
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
                </div>

                <PermissionMatrix
                  value={draft}
                  onChange={setDraft}
                  readOnly={readOnly}
                  onDependencyApplied={(message) => toast.info(message)}
                />

                {!readOnly ? (
                  <div className="sticky bottom-0 -mx-4 flex flex-col gap-2 border-t border-brand-border-subtle bg-white/95 px-4 py-3 backdrop-blur sm:mx-0 sm:flex-row sm:items-center sm:justify-between sm:px-0">
                    <p className="text-xs font-semibold text-brand-secondary-text ">
                      {dirty ? "You have unsaved changes." : "All changes are saved."}
                    </p>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <OwnerButton
                        variant="secondary"
                        disabled={!dirty}
                        onClick={() => setDraft(data.permissions)}
                      >
                        <RotateCcw className="h-4 w-4" /> Reset
                      </OwnerButton>
                      <OwnerButton disabled={!dirty} onClick={() => setConfirmSave(true)}>
                        <Save className="h-4 w-4" /> Save Permissions
                      </OwnerButton>
                    </div>
                  </div>
                ) : (
                  <OwnerButton variant="secondary" onClick={() => navigate({ to: "/owner/users" })}>
                    Back to users
                  </OwnerButton>
                )}
              </div>
            ) : null}
          </ResourceState>
        </PanelBody>
      </Panel>

      <ConfirmDialog
        open={confirmSave}
        title="Save permission changes?"
        message={`${data?.name ?? "This user"} will have ${summary.label.toLowerCase()} the next time they load the dashboard.`}
        confirmLabel="Save Changes"
        loading={saving}
        onCancel={() => setConfirmSave(false)}
        onConfirm={handleSave}
      />
    </div>
  );
}

export default EditPermissionsPage;
