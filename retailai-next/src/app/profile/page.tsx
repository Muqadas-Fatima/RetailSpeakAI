"use client";

import { useNavigate } from "@/lib/router-compat";import { MapPin, Plus, Trash2, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { BottomNav } from "@/components/shop/nav";
import { ProfileSectionList } from "@/components/shop/collections";
import { Card, PrimaryButton, Screen, ScreenHeader } from "@/components/shop/primitives";
import { useLanguage, type Language } from "@/lib/i18n";
import { useCustomerProfile } from "@/lib/customer-profile";
import { clearSession } from "@/lib/mock-accounts";
import { PREFERENCES, PROFILE, PROFILE_SECTIONS, type ProfileRow } from "@/lib/catalog";
import { useSavedAddresses, LABELS, type AddressLabel } from "@/lib/saved-addresses";
import { cn } from "@/lib/utils";



type RowTarget = "/notifications" | "/help" | "/about" | "/privacy-policy";

function ProfileScreen() {
  const navigate = useNavigate();
  const { language, setLanguage, t } = useLanguage();
  const { profile } = useCustomerProfile();
  const [showAddresses, setShowAddresses] = useState(false);
  const [showLanguage, setShowLanguage] = useState(false);

  const initials = profile.fullName
    .split(" ")
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

  const languageLabel =
    PREFERENCES.languageOptions.find((option) => option.id === language)?.label ?? language;

  const translatedSections = PROFILE_SECTIONS.map((section) => ({
    ...section,
    title: t(`profile.section.${section.id}`),
    rows: section.rows.map((row) => ({ ...row, label: t(`profile.row.${row.id}`) })),
  }));

  const handleRow = (row: ProfileRow) => {
    if (row.id === "personal") {
      navigate({ to: "/edit-profile" });
      return;
    }
    if (row.id === "addresses") {
      setShowAddresses(true);
      return;
    }
    if (row.id === "language") {
      setShowLanguage(true);
      return;
    }
    if (row.id === "logout") {
      handleLogout();
      return;
    }
    if (row.to) {
      navigate({ to: row.to as RowTarget });
      return;
    }
    toast.info(`${row.label} ${t("profile.comingSoon")}`);
  };

  const handleLogout = () => {
    clearSession();
    toast.success(t("profile.loggedOut"));
    navigate({ to: PROFILE.logout.to as "/welcome" });
  };

  return (
    <>
      <Screen>
        <ScreenHeader title={t("profile.title")} backTo="/home" />

        <Card className="mt-5 lg:mt-7">
          <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
            <div className="bg-brand-gradient grid h-14 w-14 shrink-0 place-items-center rounded-full text-base font-bold text-white lg:h-16 lg:w-16 lg:text-lg">
              {initials || "A"}
            </div>
            <div className="min-w-0">
              <p className="truncate text-[15px] font-bold text-brand-navy-deep lg:text-base">
                {profile.fullName}
              </p>
              <p className="truncate text-[12px] font-semibold text-brand-secondary-text ">
                {profile.phone}
              </p>
              <p className="truncate text-[12px] font-medium text-brand-secondary-text ">
                {profile.email}
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate({ to: "/edit-profile" })}
              className="bg-brand-gradient shrink-0 rounded-full px-3.5 py-2 text-[11px] font-bold text-white transition-transform hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan lg:text-xs"
            >
              {t("profile.editProfile")}
            </button>
          </div>
        </Card>

        <ProfileSectionList
          sections={translatedSections}
          values={{ language: languageLabel }}
          onSelect={handleRow}
        />

        <p className="mt-6 text-center text-[11px] font-semibold text-brand-muted">
          {t("profile.version")}
        </p>
      </Screen>
      <BottomNav />

      
      {showAddresses ? <SavedAddressesSheet onClose={() => setShowAddresses(false)} /> : null}
      {showLanguage ? (
        <LanguageSheet
          current={language}
          onClose={() => setShowLanguage(false)}
          onSelect={(id) => {
            setLanguage(id as Language);
            const label =
              PREFERENCES.languageOptions.find((option) => option.id === id)?.label ?? id;
            toast.success(`${t("profile.languageChanged")} ${label}`);
            setShowLanguage(false);
          }}
        />
      ) : null}
    </>
  );
}

/** Language picker bottom sheet — config-driven, applied instantly. */
function LanguageSheet({
  current,
  onClose,
  onSelect,
}: {
  current: string;
  onClose: () => void;
  onSelect: (id: string) => void;
}) {
  const { t } = useLanguage();
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center">
      <button
        type="button"
        aria-label="Close language picker"
        onClick={onClose}
        className="absolute inset-0 bg-brand-navy-deep/50 backdrop-blur-sm"
      />
      <div className="scroll-touch relative w-full rounded-t-3xl bg-white px-5 pt-5 pb-[max(2rem,env(safe-area-inset-bottom))] shadow-brand-panel">
        <div className="flex items-center justify-between">
          <h2 className="text-[16px] font-extrabold text-brand-navy-deep">
            {t("profile.row.language")}
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="rounded-lg p-1 text-brand-muted hover:text-brand-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div role="group" aria-label={t("profile.row.language")} className="mt-4 space-y-2.5">
          {PREFERENCES.languageOptions.map((option) => {
            const active = current === option.id;
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={active}
                onClick={() => onSelect(option.id)}
                className={cn(
                  "flex w-full items-center justify-between rounded-xl border px-4 py-3.5 text-[14px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan",
                  active
                    ? "border-brand-teal bg-brand-teal/10 text-brand-accent"
                    : "border-brand-border-subtle bg-white text-brand-navy-deep hover:border-brand-teal/50",
                )}
              >
                <span className={active ? "text-brand-accent" : "text-brand-navy-deep"}>
                  {option.label}
                </span>
                {active ? (
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-brand-teal text-white">
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}






/** Saved-addresses manager: lists, removes, and adds labeled addresses (Home/Office/Other). */
function SavedAddressesSheet({ onClose }: { onClose: () => void }) {
  const { addresses, addAddress, removeAddress } = useSavedAddresses();
  const { t } = useLanguage();
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState<AddressLabel>("Home");
  const [line, setLine] = useState("");

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!line.trim()) {
      toast.error(t("profile.addr.required"));
      return;
    }
    addAddress(label, line.trim());
    toast.success(`${t(`profile.addr.label.${label}`)} ${t("profile.addr.saved")}`);
    setLine("");
    setLabel("Home");
    setAdding(false);
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center">
      <button
        type="button"
        aria-label="Close saved addresses"
        onClick={onClose}
        className="absolute inset-0 bg-brand-navy-deep/50 backdrop-blur-sm"
      />
      <div className="scroll-touch relative max-h-[88svh] w-full overflow-y-auto rounded-t-3xl bg-white px-5 pt-5 pb-[max(2rem,env(safe-area-inset-bottom))] shadow-brand-panel">
        <div className="flex items-center justify-between">
          <h2 className="text-[16px] font-extrabold text-brand-navy-deep">{t("profile.addr.title")}</h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="rounded-lg p-1 text-brand-muted hover:text-brand-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Address list */}
        <div className="mt-4 space-y-3">
          {addresses.length === 0 ? (
            <p className="rounded-xl border border-dashed border-brand-border px-4 py-6 text-center text-[12px] font-medium text-brand-secondary-text">
              {t("profile.addr.empty")}
            </p>
          ) : (
            addresses.map((a) => (
              <div
                key={a.id}
                className="flex items-start gap-3 rounded-xl border border-brand-border-subtle bg-brand-surface px-4 py-3"
              >
                <div className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-teal/10 text-brand-teal">
                  <MapPin className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="inline-block rounded-full bg-brand-navy-deep/5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-navy-deep">
                    {t(`profile.addr.label.${a.label}`)}
                  </span>
                  <p className="mt-1 text-[13px] font-medium text-brand-navy-deep">{a.line}</p>
                </div>
                <button
                  type="button"
                  aria-label={`Remove ${a.label} address`}
                  onClick={() => {
                    removeAddress(a.id);
                    toast.success(`${t(`profile.addr.label.${a.label}`)} ${t("profile.addr.removed")}`);
                  }}
                  className="shrink-0 rounded-lg p-1.5 text-brand-danger transition-colors hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Add new address form */}
        {adding ? (
          <form onSubmit={submit} className="mt-4 rounded-xl border border-brand-border-subtle bg-brand-surface p-4">
            <p className="mb-2 text-[12px] font-bold text-brand-navy-deep">{t("profile.addr.addTitle")}</p>
            <div role="group" aria-label={t("profile.addr.type")} className="mb-3 flex flex-wrap gap-2">
              {LABELS.map((l) => (
                <button
                  key={l}
                  type="button"
                  aria-pressed={label === l}
                  onClick={() => setLabel(l)}
                  className={cn(
                    "rounded-full px-3.5 py-1.5 text-[11px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan",
                    label === l
                      ? "bg-brand-gradient text-white"
                      : "border border-brand-border text-brand-secondary-text hover:border-brand-teal/50",
                  )}
                >
                  {t(`profile.addr.label.${l}`)}
                </button>
              ))}
            </div>
            <label className="block">
              <span className="mb-1.5 block text-[12px] font-semibold text-brand-secondary-text">
                {t("profile.addr.field")}
              </span>
              <textarea
                rows={2}
                value={line}
                placeholder={t("profile.addr.placeholder")}
                onChange={(event) => setLine(event.target.value)}
                className="w-full resize-none rounded-xl border border-brand-border bg-white px-3 py-3 text-[13px] text-brand-navy-deep placeholder:text-brand-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan"
              />
            </label>
            <div className="mt-4 flex gap-2">
              <PrimaryButton type="submit">{t("profile.addr.save")}</PrimaryButton>
              <button
                type="button"
                onClick={() => {
                  setAdding(false);
                  setLine("");
                  setLabel("Home");
                }}
                className="rounded-xl border border-brand-border px-4 py-3 text-[12px] font-bold text-brand-secondary-text transition-colors hover:bg-brand-navy-deep/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan"
              >
                {t("profile.addr.cancel")}
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-brand-teal/50 bg-brand-teal/5 px-4 py-3.5 text-[13px] font-bold text-brand-teal transition-colors hover:bg-brand-teal/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan"
          >
            <Plus className="h-4 w-4" />
            {t("profile.addr.addNew")}
          </button>
        )}
      </div>
    </div>
  );
}

export default ProfileScreen;
