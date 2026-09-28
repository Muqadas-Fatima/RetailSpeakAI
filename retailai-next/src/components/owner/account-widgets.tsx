"use client";
/**
 * Presentational building blocks for the Owner Profile / Account page.
 * Every component is props-driven: no fetching, no business logic, no defaults
 * that could be mistaken for real data.
 */
import { Camera, KeyRound, Pencil } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { OwnerButton, OwnerModal } from "@/components/owner/confirm-dialog";
import {
  Avatar,
  Panel,
  PanelBody,
  PanelHeader,
  SkeletonBlock,
  StatusPill,
} from "@/components/owner/primitives";
import { ACCOUNT_STATUS_META, type AccountStatus } from "@/lib/owner/account-repo";
import { cn } from "@/lib/utils";

export function AccountStatusBadge({ status }: { status: AccountStatus | null }) {
  if (!status) return <StatusPill label="Unknown" tone="neutral" />;
  const meta = ACCOUNT_STATUS_META[status];
  return <StatusPill label={meta.label} tone={meta.tone} />;
}

/** Read-only label/value row used across every account section. */
export function InfoRow({
  label,
  value,
  children,
}: {
  label: string;
  value?: string | undefined;
  children?: ReactNode;
}) {
  return (
    <div className="grid gap-1 border-b border-brand-border-subtle py-3 last:border-b-0 sm:grid-cols-[200px_minmax(0,1fr)] sm:items-center sm:gap-4">
      <dt className="text-xs font-bold uppercase tracking-wide text-brand-muted">{label}</dt>
      <dd className="min-w-0 text-sm font-semibold text-brand-navy-deep ">
        {children ?? (value ? <span className="break-words">{value}</span> : <NotProvided />)}
      </dd>
    </div>
  );
}

export function NotProvided() {
  return (
    <span className="text-sm font-normal italic text-brand-secondary-text ">Not provided</span>
  );
}

export function FormField({
  id,
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  error,
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string | undefined;
  error?: string | undefined;
  autoComplete?: string | undefined;
}) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={id}
        className="block text-xs font-bold uppercase tracking-wide text-brand-muted"
      >
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        autoComplete={autoComplete}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          "w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm text-brand-navy-deep outline-none transition-colors placeholder:text-brand-muted focus-visible:ring-2 focus-visible:ring-brand-cyan ",
          error ? "border-destructive" : "border-brand-border ",
        )}
      />
      {error ? (
        <p id={`${id}-error`} className="text-xs font-semibold text-brand-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Profile summary: avatar, name, read-only role, store, status badge. */
export function ProfileSummaryCard({
  name,
  role,
  storeName,
  status,
  avatarUrl,
  onEditAvatar,
}: {
  name: string;
  role: string;
  storeName: string;
  status: AccountStatus | null;
  avatarUrl?: string | undefined;
  onEditAvatar: () => void;
}) {
  return (
    <Panel>
      <PanelBody className="flex flex-col items-center gap-4 text-center sm:flex-row sm:items-center sm:gap-5 sm:text-start">
        <div className="relative shrink-0">
          <Avatar
            name={name || "Owner"}
            src={avatarUrl}
            className="h-20 w-20 text-2xl sm:h-24 sm:w-24"
          />
          <button
            type="button"
            onClick={onEditAvatar}
            aria-label="Edit profile picture"
            className="absolute -bottom-1 -end-1 grid h-9 w-9 place-items-center rounded-full border-2 border-white bg-brand-navy-deep text-white transition-colors hover:bg-brand-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan "
          >
            <Camera className="h-4 w-4" />
          </button>
        </div>
        <div className="min-w-0 flex-1 space-y-1.5">
          <h2 className="truncate text-lg font-black text-brand-navy-deep sm:text-xl">
            {name || <NotProvided />}
          </h2>
          <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
            <StatusPill label={role || "—"} tone="info" />
            <AccountStatusBadge status={status} />
          </div>
          <p className="truncate text-sm text-brand-secondary-text ">
            {storeName || "No store linked yet"}
          </p>
        </div>
        <div className="w-full sm:w-auto">
          <OwnerButton variant="secondary" onClick={onEditAvatar} className="w-full sm:w-auto">
            <Pencil className="h-4 w-4" />
            Edit Profile Picture
          </OwnerButton>
        </div>
      </PanelBody>
    </Panel>
  );
}

/** Frontend-only avatar picker: shows the chosen file preview, never uploads. */
export function AvatarPickerModal({
  open,
  name,
  onClose,
}: {
  open: boolean;
  name: string;
  onClose: () => void;
}) {
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!open) setPreview(null);
  }, [open]);

  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  return (
    <OwnerModal
      open={open}
      onClose={onClose}
      title="Profile picture"
      description="Choose an image to preview. Uploading is handled by the backend later."
      size="sm"
      footer={
        <OwnerButton variant="secondary" onClick={onClose}>
          Close
        </OwnerButton>
      }
    >
      <div className="flex flex-col items-center gap-4">
        <Avatar name={name || "Owner"} src={preview ?? undefined} className="h-24 w-24 text-2xl" />
        <label className="w-full cursor-pointer rounded-xl border border-dashed border-brand-border px-4 py-6 text-center text-sm font-semibold text-brand-secondary-text transition-colors hover:bg-brand-surface-2 ">
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) setPreview(URL.createObjectURL(file));
            }}
          />
          Choose an image
        </label>
        <p className="text-xs text-brand-secondary-text ">Preview only — nothing is saved.</p>
      </div>
    </OwnerModal>
  );
}

/** Placeholder change-password entry point (no password logic). */
export function ChangePasswordCard({ onOpen }: { onOpen: () => void }) {
  return (
    <Panel>
      <PanelHeader title="Security" description="Password and sign-in options." />
      <PanelBody className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-cyan/12 text-brand-accent">
            <KeyRound className="h-4.5 w-4.5" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-brand-navy-deep ">Change password</p>
            <p className="text-xs text-brand-secondary-text ">
              Update the password used to sign in to this dashboard.
            </p>
          </div>
        </div>
        <OwnerButton variant="secondary" onClick={onOpen} className="w-full sm:w-auto">
          Change Password
        </OwnerButton>
      </PanelBody>
    </Panel>
  );
}

export function ChangePasswordModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <OwnerModal
      open={open}
      onClose={onClose}
      title="Change password"
      description="This flow will be handled by authentication."
      size="sm"
      footer={
        <OwnerButton variant="secondary" onClick={onClose}>
          Close
        </OwnerButton>
      }
    >
      <p className="text-sm text-brand-secondary-text ">
        Password changes are managed by the authentication service. Once connected, this dialog will
        collect the current and new password and submit them securely.
      </p>
    </OwnerModal>
  );
}

/** Skeleton mirroring the account page layout. */
export function AccountSkeleton() {
  return (
    <div className="space-y-4 sm:space-y-5" role="status" aria-label="Loading account">
      <Panel>
        <PanelBody className="flex flex-col items-center gap-4 sm:flex-row">
          <SkeletonBlock className="h-24 w-24 rounded-full" />
          <div className="w-full space-y-2">
            <SkeletonBlock className="h-5 w-48" />
            <SkeletonBlock className="h-4 w-32" />
            <SkeletonBlock className="h-4 w-40" />
          </div>
        </PanelBody>
      </Panel>
      <div className="grid gap-4 sm:gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <SkeletonBlock className="h-72 rounded-2xl" />
        <div className="space-y-4 sm:space-y-5">
          <SkeletonBlock className="h-40 rounded-2xl" />
          <SkeletonBlock className="h-40 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
