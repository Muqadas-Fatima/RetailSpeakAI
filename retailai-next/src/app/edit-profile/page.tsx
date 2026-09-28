"use client";

import { useNavigate } from "@/lib/router-compat";import { Key, Mail } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { BottomNav } from "@/components/shop/nav";
import { PrimaryButton, Screen, ScreenHeader } from "@/components/shop/primitives";
import { useLanguage } from "@/lib/i18n";
import { useCustomerProfile, type CustomerProfile } from "@/lib/customer-profile";
import { PREFERENCES } from "@/lib/catalog";
import { cn } from "@/lib/utils";



const FIELD_CLASS =
  "w-full rounded-xl border border-brand-border bg-white px-3 py-3 text-[13px] text-brand-navy-deep placeholder:text-brand-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan";

/** Editable personal information, rendered from the mock field config. */
function EditProfileScreen() {
  const navigate = useNavigate();
  const { profile, update } = useCustomerProfile();
  const { t } = useLanguage();
  const [draft, setDraft] = useState<CustomerProfile>(profile);
  const [newEmail, setNewEmail] = useState("");
  const [pw, setPw] = useState({ currentPw: "", newPw: "", confirmPw: "" });

  useEffect(() => {
    setDraft(profile);
  }, [profile]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!draft.fullName.trim() || !draft.email.trim()) {
      toast.error(t("profile.edit.required"));
      return;
    }

    const nextEmail = newEmail.trim();
    if (nextEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(nextEmail)) {
      toast.error(t("profile.edit.emailInvalid"));
      return;
    }

    const anyPw = pw.currentPw.trim() || pw.newPw.trim() || pw.confirmPw.trim();
    if (anyPw) {
      if (!pw.currentPw.trim() || !pw.newPw.trim() || !pw.confirmPw.trim()) {
        toast.error(t("profile.edit.pwRequired"));
        return;
      }
      if (pw.newPw.length < 8) {
        toast.error(t("profile.edit.pwShort"));
        return;
      }
      if (pw.newPw !== pw.confirmPw) {
        toast.error(t("profile.edit.pwMismatch"));
        return;
      }
    }

    update({
      fullName: draft.fullName.trim(),
      email: nextEmail || draft.email.trim(),
      phone: draft.phone.trim(),
      address: draft.address.trim(),
    });
    toast.success(t("profile.edit.updated"));
    setNewEmail("");
    setPw({ currentPw: "", newPw: "", confirmPw: "" });
    navigate({ to: "/profile" });
  };

  return (
    <>
      <Screen>
        <ScreenHeader title={t("profile.edit.title")} backTo="/profile" />

        <form onSubmit={submit} className="mt-5 lg:mt-7">
          <div className="space-y-3">
            {PREFERENCES.editFields.map((field) => {
              const key = field.id as keyof CustomerProfile;
              const value = draft[key] ?? "";
              const shared =
                "w-full rounded-xl border border-brand-border bg-white px-3 py-3 text-[13px] text-brand-navy-deep placeholder:text-brand-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan ";
              return (
                <label key={field.id} className="block">
                  <span className="mb-1.5 block text-[12px] font-semibold text-brand-secondary-text ">
                    {t(`profile.edit.${field.id}`)}
                  </span>
                  {field.type === "textarea" ? (
                    <textarea
                      rows={3}
                      value={value}
                      placeholder={t(`profile.edit.${field.id}Ph`)}
                      onChange={(event) =>
                        setDraft((prev) => ({ ...prev, [key]: event.target.value }))
                      }
                      className={cn(shared, "resize-none")}
                    />
                  ) : (
                    <input
                      type={field.type}
                      value={value}
                      placeholder={t(`profile.edit.${field.id}Ph`)}
                      onChange={(event) =>
                        setDraft((prev) => ({ ...prev, [key]: event.target.value }))
                      }
                      className={shared}
                    />
                  )}
                </label>
              );
            })}
          </div>

          <ChangeEmailPanel value={newEmail} onChange={setNewEmail} />
          <ChangePasswordPanel values={pw} onChange={(id, v) => setPw((p) => ({ ...p, [id]: v }))} />

          <div className="mt-5 mb-2">
            <PrimaryButton type="submit">{t("profile.edit.save")}</PrimaryButton>
          </div>
        </form>
      </Screen>
      <BottomNav />
    </>
  );
}

function EditSection({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Mail;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-5 rounded-2xl border border-brand-border-subtle bg-white p-4">
      <div className="flex items-center gap-2">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-teal/10 text-brand-teal">
          <Icon className="h-4.5 w-4.5" />
        </span>
        <h3 className="text-[13px] font-extrabold text-brand-navy-deep">{title}</h3>
      </div>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

/** Change Email — saved together with the rest of the page. */
function ChangeEmailPanel({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const { t } = useLanguage();

  return (
    <EditSection icon={Mail} title={t("profile.row.email-change")}>
      <label className="block">
        <span className="mb-1.5 block text-[12px] font-semibold text-brand-secondary-text">
          {t("profile.edit.newEmail")}
        </span>
        <input
          type="email"
          value={value}
          placeholder={t("profile.edit.newEmailPh")}
          onChange={(event) => onChange(event.target.value)}
          className={FIELD_CLASS}
        />
      </label>
    </EditSection>
  );
}

type PasswordFieldId = "currentPw" | "newPw" | "confirmPw";

/** Change Password — saved together with the rest of the page. */
function ChangePasswordPanel({
  values,
  onChange,
}: {
  values: Record<PasswordFieldId, string>;
  onChange: (id: PasswordFieldId, value: string) => void;
}) {
  const { t } = useLanguage();
  const ids: PasswordFieldId[] = ["currentPw", "newPw", "confirmPw"];

  return (
    <EditSection icon={Key} title={t("profile.row.password")}>
      {ids.map((id) => (
        <label key={id} className="block">
          <span className="mb-1.5 block text-[12px] font-semibold text-brand-secondary-text">
            {t(`profile.edit.${id}`)}
          </span>
          <input
            type="password"
            value={values[id]}
            autoComplete="new-password"
            placeholder={t(`profile.edit.${id}Ph`)}
            onChange={(event) => onChange(id, event.target.value)}
            className={FIELD_CLASS}
          />
        </label>
      ))}
    </EditSection>
  );
}

export default EditProfileScreen;
