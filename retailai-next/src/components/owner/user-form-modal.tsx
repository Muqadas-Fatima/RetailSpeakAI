"use client";
import { useMemo, useState } from "react";
import { ConfirmDialog, OwnerButton, OwnerModal } from "@/components/owner/confirm-dialog";
import { PermissionMatrix } from "@/components/owner/permission-matrix";
import {
  ASSIGNABLE_ROLES,
  type PermissionKey,
  type RoleId,
  summarisePermissions,
} from "@/lib/owner/permissions";
import type { CreateUserInput } from "@/lib/owner/users-repo";
import { cn } from "@/lib/utils";

type Errors = Partial<Record<"name" | "contact" | "role", string>>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_PATTERN = /^\+?[\d\s-]{7,18}$/;

/**
 * Add User flow: identity -> role -> permission assignment. Owner is never an
 * option (owner accounts are managed by authentication).
 */
export function AddUserModal({
  open,
  onClose,
  onSubmit,
  onDependencyNote,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: CreateUserInput) => Promise<void>;
  onDependencyNote?: ((message: string) => void) | undefined;
}) {
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [roleId, setRoleId] = useState<RoleId | "">("");
  const [permissions, setPermissions] = useState<PermissionKey[]>([]);
  const [errors, setErrors] = useState<Errors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);

  const dirty =
    name.trim() !== "" || contact.trim() !== "" || roleId !== "" || permissions.length > 0;
  const summary = useMemo(() => summarisePermissions(permissions), [permissions]);

  const reset = () => {
    setName("");
    setContact("");
    setRoleId("");
    setPermissions([]);
    setErrors({});
    setSubmitError(null);
  };

  const requestClose = () => {
    if (dirty && !saving) {
      setConfirmClose(true);
      return;
    }
    reset();
    onClose();
  };

  const validate = (): boolean => {
    const next: Errors = {};
    if (name.trim().length < 2) next.name = "Enter the full name (min. 2 characters).";
    const value = contact.trim();
    if (!value) next.contact = "Enter an email address or phone number.";
    else if (!EMAIL_PATTERN.test(value) && !PHONE_PATTERN.test(value))
      next.contact = "Enter a valid email address or phone number.";
    if (!roleId) next.role = "Select a role for this user.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSaving(true);
    setSubmitError(null);
    const value = contact.trim();
    const isEmail = EMAIL_PATTERN.test(value);
    try {
      await onSubmit({
        name: name.trim(),
        email: isEmail ? value : null,
        phone: isEmail ? null : value,
        roleId: roleId as RoleId,
        permissions,
      });
      reset();
      onClose();
    } catch (cause) {
      setSubmitError(cause instanceof Error ? cause.message : "Could not create this user.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <OwnerModal
        open={open}
        onClose={requestClose}
        title="Add User"
        description="Invite a co-owner or manager and choose exactly what they can access."
        size="lg"
        footer={
          <>
            <OwnerButton variant="secondary" onClick={requestClose}>
              Cancel
            </OwnerButton>
            <OwnerButton onClick={handleSubmit} loading={saving}>
              Create User
            </OwnerButton>
          </>
        }
      >
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full Name" error={errors.name} htmlFor="user-name">
              <input
                id="user-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. team member's full name"
                className={inputClass(Boolean(errors.name))}
              />
            </Field>
            <Field label="Email or Phone" error={errors.contact} htmlFor="user-contact">
              <input
                id="user-contact"
                value={contact}
                onChange={(event) => setContact(event.target.value)}
                placeholder="email address or phone number"
                className={inputClass(Boolean(errors.contact))}
              />
            </Field>
          </div>

          <Field label="Role" error={errors.role}>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {ASSIGNABLE_ROLES.map((role) => {
                const selected = roleId === role.id;
                return (
                  <button
                    key={role.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setRoleId(role.id)}
                    className={cn(
                      "rounded-2xl border p-3.5 text-start transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan",
                      selected
                        ? "border-brand-teal bg-brand-teal/8"
                        : "border-brand-border bg-white hover:border-brand-teal/40 ",
                    )}
                  >
                    <span className="block text-sm font-bold text-brand-navy-deep ">
                      {role.label}
                    </span>
                    <span className="mt-0.5 block text-xs text-brand-secondary-text ">
                      {role.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </Field>

          {roleId ? (
            <section className="space-y-3 border-t border-brand-border-subtle pt-4 ">
              <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-brand-navy-deep ">Permission assignment</h3>
                  <p className="text-xs text-brand-secondary-text ">
                    Nothing is inherited — grant each module explicitly.
                  </p>
                </div>
                <span className="shrink-0 text-xs font-semibold text-brand-accent">
                  {summary.label}
                </span>
              </header>
              <PermissionMatrix
                value={permissions}
                onChange={setPermissions}
                onDependencyApplied={onDependencyNote}
              />
            </section>
          ) : (
            <p className="rounded-xl bg-brand-surface-2 px-3.5 py-3 text-xs text-brand-secondary-text ">
              Select a role to assign permissions.
            </p>
          )}

          {submitError ? (
            <p role="alert" className="text-sm font-semibold text-brand-danger">
              {submitError}
            </p>
          ) : null}
        </div>
      </OwnerModal>

      <ConfirmDialog
        open={confirmClose}
        title="Discard this user?"
        message="You have unsaved details. Closing now discards the name, role and permissions you selected."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        tone="danger"
        onCancel={() => setConfirmClose(false)}
        onConfirm={() => {
          setConfirmClose(false);
          reset();
          onClose();
        }}
      />
    </>
  );
}

function inputClass(invalid: boolean): string {
  return cn(
    "w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm text-brand-navy-deep outline-none transition-colors placeholder:text-brand-muted focus:border-brand-teal ",
    invalid ? "border-destructive" : "border-brand-border ",
  );
}

function Field({
  label,
  error,
  htmlFor,
  children,
}: {
  label: string;
  error?: string | undefined;
  htmlFor?: string | undefined;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0 space-y-1.5">
      <label
        htmlFor={htmlFor}
        className="block text-xs font-bold uppercase tracking-wide text-brand-muted"
      >
        {label}
      </label>
      {children}
      {error ? (
        <p role="alert" className="text-xs font-semibold text-brand-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
