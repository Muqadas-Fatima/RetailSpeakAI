"use client";

import { Store, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  AccountSkeleton,
  AccountStatusBadge,
  AvatarPickerModal,
  ChangePasswordCard,
  ChangePasswordModal,
  FormField,
  InfoRow,
  NotProvided,
  ProfileSummaryCard,
} from "@/components/owner/account-widgets";
import { ConfirmDialog, OwnerButton } from "@/components/owner/confirm-dialog";
import {
  EmptyState,
  ErrorState,
  Panel,
  PanelBody,
  PanelHeader,
  StatusPill,
} from "@/components/owner/primitives";
import type { OwnerAccount, PersonalInfoInput } from "@/lib/owner/account-repo";
import { useOwnerAccount, useUpdatePersonalInfo } from "@/lib/owner/account-hooks";



function OwnerProfilePage() {
  const { data, isLoading, error, refetch } = useOwnerAccount();
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);

  if (isLoading) return <AccountSkeleton />;

  if (error) {
    return (
      <Panel>
        <PanelBody>
          <ErrorState message={error} onRetry={refetch} />
        </PanelBody>
      </Panel>
    );
  }

  return (
    <div id="profile" className="space-y-4 sm:space-y-5">
      <header className="space-y-1">
        <h1 className="text-xl font-black text-brand-navy-deep sm:text-2xl">
          Profile &amp; Account
        </h1>
        <p className="text-sm text-brand-secondary-text ">
          Your owner identity, store link and sign-in security.
        </p>
      </header>

      {!data ? (
        <Panel>
          <PanelBody>
            <EmptyState
              title="No account details yet"
              description="Owner profile data will appear here once the account service is connected."
            />
            <div className="flex justify-center">
              <OwnerButton variant="secondary" onClick={refetch}>
                Reload
              </OwnerButton>
            </div>
          </PanelBody>
        </Panel>
      ) : (
        <AccountContent
          account={data}
          onEditAvatar={() => setAvatarOpen(true)}
          onChangePassword={() => setPasswordOpen(true)}
        />
      )}

      <AvatarPickerModal
        open={avatarOpen}
        name={data?.fullName ?? "Owner"}
        onClose={() => setAvatarOpen(false)}
      />
      <ChangePasswordModal open={passwordOpen} onClose={() => setPasswordOpen(false)} />
    </div>
  );
}

function AccountContent({
  account,
  onEditAvatar,
  onChangePassword,
}: {
  account: OwnerAccount;
  onEditAvatar: () => void;
  onChangePassword: () => void;
}) {
  return (
    <>
      <ProfileSummaryCard
        name={account.fullName}
        role={account.role}
        storeName={account.storeName}
        status={account.status}
        avatarUrl={account.avatarUrl}
        onEditAvatar={onEditAvatar}
      />

      <div className="grid gap-4 sm:gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] xl:items-start">
        <PersonalInformationCard account={account} />

        <div className="space-y-4 sm:space-y-5">
          <Panel>
            <PanelHeader title="Role" description="Managed by authentication." />
            <PanelBody>
              <dl>
                <InfoRow label="Role">
                  <span className="flex flex-wrap items-center gap-2">
                    <StatusPill label={account.role || "—"} tone="info" />
                    <span className="text-xs font-normal text-brand-secondary-text ">
                      Read only
                    </span>
                  </span>
                </InfoRow>
              </dl>
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader title="Store Information" description="Linked business profile." />
            <PanelBody>
              <div className="flex items-start gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-surface-2 text-brand-secondary-text ">
                  <Store className="h-4.5 w-4.5" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-wide text-brand-muted">
                    Store Name
                  </p>
                  <p className="mt-0.5 break-words text-sm font-semibold text-brand-navy-deep ">
                    {account.storeName || <NotProvided />}
                  </p>
                </div>
              </div>
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader title="Account Status" description="Current verification state." />
            <PanelBody className="flex items-center justify-between gap-3">
              <p className="text-sm text-brand-secondary-text ">Status</p>
              <AccountStatusBadge status={account.status} />
            </PanelBody>
          </Panel>

          <div id="account-settings" className="scroll-mt-24">
            <ChangePasswordCard onOpen={onChangePassword} />
          </div>
        </div>
      </div>
    </>
  );
}

type Errors = Partial<Record<keyof PersonalInfoInput, string>>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_PATTERN = /^\+?[\d\s()-]{7,20}$/;

function validate(values: PersonalInfoInput): Errors {
  const errors: Errors = {};
  if (values.fullName.trim().length < 2) errors.fullName = "Enter at least 2 characters.";
  if (!EMAIL_PATTERN.test(values.email.trim())) errors.email = "Enter a valid email address.";
  if (!PHONE_PATTERN.test(values.phone.trim())) errors.phone = "Enter a valid phone number.";
  return errors;
}

function PersonalInformationCard({ account }: { account: OwnerAccount }) {
  const { save, isSaving } = useUpdatePersonalInfo();
  const [editing, setEditing] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [values, setValues] = useState<PersonalInfoInput>({
    fullName: account.fullName,
    email: account.email,
    phone: account.phone,
  });

  // Re-sync whenever fresh account data arrives (e.g. after a refetch).
  useEffect(() => {
    setValues({ fullName: account.fullName, email: account.email, phone: account.phone });
  }, [account.fullName, account.email, account.phone]);

  const dirty =
    values.fullName !== account.fullName ||
    values.email !== account.email ||
    values.phone !== account.phone;

  const reset = () => {
    setValues({ fullName: account.fullName, email: account.email, phone: account.phone });
    setErrors({});
    setEditing(false);
  };

  const handleCancel = () => {
    if (dirty) {
      setConfirmCancel(true);
      return;
    }
    reset();
  };

  const handleSave = async () => {
    const nextErrors = validate(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      toast.error("Please fix the highlighted fields.");
      return;
    }
    const result = await save(values);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("Personal information updated.");
    setEditing(false);
  };

  return (
    <Panel>
      <PanelHeader title="Personal Information" description="Name and contact details.">
        {editing ? null : (
          <OwnerButton variant="secondary" onClick={() => setEditing(true)} className="px-3 py-2">
            Edit
          </OwnerButton>
        )}
      </PanelHeader>
      <PanelBody>
        {editing ? (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void handleSave();
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                id="account-full-name"
                label="Full Name"
                value={values.fullName}
                error={errors.fullName}
                autoComplete="name"
                placeholder="Full name"
                onChange={(value) => setValues((prev) => ({ ...prev, fullName: value }))}
              />
              <FormField
                id="account-email"
                label="Email Address"
                type="email"
                value={values.email}
                error={errors.email}
                autoComplete="email"
                placeholder="name@example.com"
                onChange={(value) => setValues((prev) => ({ ...prev, email: value }))}
              />
              <FormField
                id="account-phone"
                label="Phone Number"
                type="tel"
                value={values.phone}
                error={errors.phone}
                autoComplete="tel"
                placeholder="+00 000 0000000"
                onChange={(value) => setValues((prev) => ({ ...prev, phone: value }))}
              />
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <OwnerButton variant="secondary" onClick={handleCancel} className="w-full sm:w-auto">
                <X className="h-4 w-4" />
                Cancel
              </OwnerButton>
              <OwnerButton
                type="submit"
                loading={isSaving}
                disabled={!dirty}
                className="w-full sm:w-auto"
              >
                Save Changes
              </OwnerButton>
            </div>
          </form>
        ) : (
          <dl>
            <InfoRow label="Full Name" value={account.fullName} />
            <InfoRow label="Email Address" value={account.email} />
            <InfoRow label="Phone Number" value={account.phone} />
          </dl>
        )}
      </PanelBody>

      <ConfirmDialog
        open={confirmCancel}
        title="Discard changes?"
        message="Your edits to the personal information have not been saved."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        tone="danger"
        onCancel={() => setConfirmCancel(false)}
        onConfirm={() => {
          setConfirmCancel(false);
          reset();
        }}
      />
    </Panel>
  );
}

export default OwnerProfilePage;
