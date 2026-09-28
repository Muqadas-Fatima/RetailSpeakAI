"use client";

import { Link, useNavigate } from "@/lib/router-compat";import { useMemo, useState, type ReactNode } from "react";
import { z } from "zod";
import { DarkDecor } from "@/components/auth/decor";
import { InputField, PrimaryButton } from "@/components/auth/controls";
import { addMockAccount, mockAccountExists } from "@/lib/mock-accounts";
import { setPendingSignup } from "@/lib/onboarding";
import { useLanguage } from "@/lib/i18n";



type TranslateFn = (key: string) => string;

function buildSignUpSchema(t: TranslateFn) {
  return z
    .object({
      fullName: z.string().trim().min(1, t("val.fullName")).max(100),
      email: z.string().trim().min(1, t("val.emailRequired")).email(t("val.emailInvalid")).max(255),
      phone: z
        .string()
        .trim()
        .min(1, t("val.phoneRequired"))
        .regex(/^[0-9+()\s-]{7,20}$/, t("val.phoneInvalid")),
      gender: z.string().min(1, t("val.gender")),
      age: z
        .string()
        .min(1, t("val.ageRequired"))
        .refine((v) => /^\d+$/.test(v), { message: t("val.ageNumber") })
        .refine(
          (v) => {
            const n = Number(v);
            return n >= 13 && n <= 120;
          },
          { message: t("val.ageRange") },
        ),
      language: z.string().min(1, t("val.language")),
      password: z.string().min(1, t("val.passwordRequired")).min(6, t("val.passwordMin")),
      confirmPassword: z.string().min(1, t("val.confirmRequired")),
    })
    .refine((v) => v.password === v.confirmPassword, {
      path: ["confirmPassword"],
      message: t("val.passwordMismatch"),
    });
}

type FieldName =
  "fullName" | "email" | "phone" | "gender" | "age" | "language" | "password" | "confirmPassword";
type Errors = Partial<Record<FieldName, string>>;

const emptyForm: Record<FieldName, string> = {
  fullName: "",
  email: "",
  phone: "",
  gender: "",
  age: "",
  language: "",
  password: "",
  confirmPassword: "",
};

function UserIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      aria-hidden
    >
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      aria-hidden
    >
      <rect x="3" y="5.5" width="18" height="13" rx="2.5" />
      <path d="m4 7 8 6 8-6" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      aria-hidden
    >
      <rect x="6.5" y="2.5" width="11" height="19" rx="3" />
      <path d="M10.5 18.5h3" />
    </svg>
  );
}

function GenderIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      aria-hidden
    >
      <circle cx="12" cy="7" r="4" />
      <path d="M12 11v9M9 17h6" />
    </svg>
  );
}

function AgeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" />
    </svg>
  );
}

function LanguageIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3c2.5 3.5 3 5.5 3 9s-.5 5.5-3 9" />
      <path d="M12 3c-2.5 3.5-3 5.5-3 9s.5 5.5 3 9" />
      <path d="M3 12h18" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      aria-hidden
    >
      <rect x="4.5" y="10.5" width="15" height="9" rx="2.5" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function EyeToggle({
  shown,
  onClick,
  label,
}: {
  shown: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={shown ? `Hide ${label}` : `Show ${label}`}
      aria-pressed={shown}
      className="grid h-9 w-9 place-items-center rounded-lg transition-colors hover:text-brand-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal"
    >
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        aria-hidden
      >
        <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
        <circle cx="12" cy="12" r="3" />
        {!shown && <path d="M4 20 20 4" />}
      </svg>
    </button>
  );
}

function Field({
  error,
  children,
  id,
}: {
  error?: string | undefined;
  children: ReactNode;
  id: string;
}) {
  return (
    <div>
      {children}
      {error && (
        <p
          id={`${id}-error`}
          role="alert"
          className="mt-1.5 px-1 text-xs font-medium text-brand-danger sm:text-sm"
        >
          {error}
        </p>
      )}
    </div>
  );
}

const selectClass = (error: string | undefined, value: string) =>
  `h-[54px] w-full appearance-none rounded-[14px] border border-transparent bg-brand-surface-2/80 pl-12 pr-12 text-sm text-brand-ink focus:border-brand-teal focus:outline-none focus:ring-2 focus:ring-brand-teal/20 sm:text-base ${
    error ? "border-red-400 ring-2 ring-red-500/20" : ""
  } ${!value ? "text-brand-muted" : ""}`;

function GenderSelect({
  id,
  value,
  onChange,
  error,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | undefined;
}) {
  const { t } = useLanguage();
  return (
    <div className="relative">
      <label htmlFor={id} className="sr-only">
        {t("signup.gender")}
      </label>
      <span
        aria-hidden
        className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-brand-muted"
      >
        <GenderIcon />
      </span>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        className={selectClass(error, value)}
      >
        <option value="" disabled>
          {t("signup.gender")}
        </option>
        <option value="male">{t("signup.gender.male")}</option>
        <option value="female">{t("signup.gender.female")}</option>
        <option value="other">{t("signup.gender.other")}</option>
        <option value="prefer-not-to-say">{t("signup.gender.preferNotToSay")}</option>
      </select>
      <span
        aria-hidden
        className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-brand-muted"
      >
        <ChevronIcon />
      </span>
    </div>
  );
}

function LanguageSelect({
  id,
  value,
  onChange,
  error,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | undefined;
}) {
  const { t } = useLanguage();
  return (
    <div className="relative">
      <label htmlFor={id} className="sr-only">
        {t("signup.language")}
      </label>
      <span
        aria-hidden
        className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-brand-muted"
      >
        <LanguageIcon />
      </span>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        className={selectClass(error, value)}
      >
        <option value="" disabled>
          {t("signup.language")}
        </option>
        <option value="english">{t("signup.lang.english")}</option>
        <option value="urdu">{t("signup.lang.urdu")}</option>
      </select>
      <span
        aria-hidden
        className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-brand-muted"
      >
        <ChevronIcon />
      </span>
    </div>
  );
}

function SignUpScreen() {
  const navigate = useNavigate();
  const { t, setLanguage } = useLanguage();
  const signUpSchema = useMemo(() => buildSignUpSchema(t), [t]);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState<Errors>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [duplicateEmail, setDuplicateEmail] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const update = (name: FieldName) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [name]: e.target.value }));
    setErrors((prev) => (prev[name] ? { ...prev, [name]: undefined } : prev));
    setDuplicateEmail(null);
  };

  const updateSelect = (name: "gender" | "language") => (value: string) => {
    setForm((f) => ({ ...f, [name]: value }));
    setErrors((prev) => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
  };

  const fieldProps = (name: FieldName) => ({
    id: name,
    value: form[name],
    onChange: update(name),
    "aria-invalid": Boolean(errors[name]),
    "aria-describedby": errors[name] ? `${name}-error` : undefined,
    className: errors[name] ? "border-red-400 ring-2 ring-red-500/20" : "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setDuplicateEmail(null);
    const parsed = signUpSchema.safeParse(form);
    if (!parsed.success) {
      const next: Errors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as FieldName;
        if (key && !next[key]) next[key] = issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});

    if (mockAccountExists(parsed.data.email)) {
      setDuplicateEmail(parsed.data.email);
      return;
    }

    setLoading(true);
    window.setTimeout(() => {
      const langCode = parsed.data.language === "urdu" ? "ur" : "en";
      addMockAccount({
        fullName: parsed.data.fullName,
        email: parsed.data.email,
        phone: parsed.data.phone,
        gender: parsed.data.gender,
        age: Number(parsed.data.age),
        language: langCode,
        password: parsed.data.password,
      });
      setPendingSignup({ email: parsed.data.email, fullName: parsed.data.fullName });
      // The language picked at signup becomes the active app language.
      setLanguage(langCode);
      setLoading(false);
      setSuccess(true);
      setForm(emptyForm);
    }, 600);
  };

  return (
    <main className="relative flex min-h-[100svh] flex-col overflow-hidden bg-brand-navy-deep">
      <DarkDecor showTopCircle={false} />

      {/* top bar */}
      <div className="relative z-20 mx-auto flex w-full max-w-[1280px] items-center px-4 pt-[max(1rem,env(safe-area-inset-top))] sm:px-8 sm:pt-6 lg:px-12">
        <button
          type="button"
          aria-label={t("common.back")}
          onClick={() => navigate({ to: "/signin" })}
          className="grid h-10 w-10 place-items-center rounded-full text-brand-on-dark transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-6 w-6"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M19 12H5M11 18l-6-6 6-6" />
          </svg>
        </button>
      </div>

      {/* content */}
      <div className="relative z-10 mx-auto flex w-full max-w-[1280px] flex-1 flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(420px,480px)] lg:items-stretch lg:gap-16 lg:px-12">
        <div className="flex min-w-0 flex-col justify-start px-6 pb-7 pt-5 sm:px-8 lg:justify-center lg:px-0 lg:pb-16 lg:pt-0">
          <h1 className="text-[clamp(2rem,9vw,2.5rem)] font-bold leading-tight text-brand-on-dark lg:text-[2.25rem]">
            {t("signup.title")}
          </h1>
          <p className="mt-2 max-w-[22rem] text-sm leading-relaxed text-brand-on-dark/80 sm:text-base">
            {t("signup.subtitle")}
          </p>
        </div>

        <div className="mt-auto w-full rounded-t-[2rem] bg-white px-5 pb-[max(2rem,env(safe-area-inset-bottom))] pt-8 shadow-brand-card sm:px-8 sm:pt-9 lg:mx-auto lg:mt-0 lg:px-8 lg:pb-10 lg:pt-9">
          {success ? (
            <div className="mx-auto max-w-sm py-4 text-center">
              <span
                aria-hidden
                className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-brand-gradient text-white"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-7 w-7"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="m5 13 4 4L19 7" />
                </svg>
              </span>
              <h2 className="mt-5 text-xl font-bold text-brand-ink sm:text-2xl">
                {t("signup.success.title")}
              </h2>
              <p role="status" className="mt-2 text-sm text-brand-secondary-text sm:text-base">
                {t("signup.success.body")}
              </p>
              <PrimaryButton
                type="button"
                onClick={() => navigate({ to: "/location", search: { flow: "signup" } })}
                className="mt-6 h-[54px] w-full rounded-[14px] text-base"
              >
                {t("signup.success.cta")}
              </PrimaryButton>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate className="w-full">
              {duplicateEmail && (
                <div
                  role="alert"
                  className="mb-5 rounded-[14px] border border-brand-border bg-brand-surface p-4 text-start"
                >
                  <p className="text-sm font-semibold text-brand-ink">{t("signup.duplicate")}</p>
                  <Link
                    to="/signin"
                    className="mt-2 inline-flex text-sm font-semibold text-brand-accent transition-colors hover:text-brand-teal"
                  >
                    {t("common.signIn")}
                  </Link>
                </div>
              )}

              <div className="flex flex-col gap-4">
                <Field id="fullName" error={errors.fullName}>
                  <InputField
                    {...fieldProps("fullName")}
                    label={t("signup.fullName")}
                    placeholder={t("signup.fullName")}
                    autoComplete="name"
                    required
                    icon={<UserIcon />}
                  />
                </Field>
                <Field id="email" error={errors.email}>
                  <InputField
                    {...fieldProps("email")}
                    label={t("signup.email")}
                    placeholder={t("signup.email")}
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    required
                    icon={<MailIcon />}
                  />
                </Field>
                <Field id="phone" error={errors.phone}>
                  <InputField
                    {...fieldProps("phone")}
                    label={t("signup.phone")}
                    placeholder={t("signup.phone")}
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    required
                    icon={<PhoneIcon />}
                  />
                </Field>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field id="gender" error={errors.gender}>
                    <GenderSelect
                      id="gender"
                      value={form.gender}
                      onChange={updateSelect("gender")}
                      error={errors.gender}
                    />
                  </Field>
                  <Field id="age" error={errors.age}>
                    <InputField
                      {...fieldProps("age")}
                      label={t("signup.age")}
                      placeholder={t("signup.age")}
                      type="number"
                      inputMode="numeric"
                      min={13}
                      max={120}
                      required
                      icon={<AgeIcon />}
                    />
                  </Field>
                </div>
                <Field id="language" error={errors.language}>
                  <LanguageSelect
                    id="language"
                    value={form.language}
                    onChange={updateSelect("language")}
                    error={errors.language}
                  />
                </Field>
                <Field id="password" error={errors.password}>
                  <InputField
                    {...fieldProps("password")}
                    label={t("signup.password")}
                    placeholder={t("signup.password")}
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    icon={<LockIcon />}
                    trailing={
                      <EyeToggle
                        shown={showPassword}
                        onClick={() => setShowPassword((v) => !v)}
                        label="password"
                      />
                    }
                  />
                </Field>
                <Field id="confirmPassword" error={errors.confirmPassword}>
                  <InputField
                    {...fieldProps("confirmPassword")}
                    label={t("signup.confirmPassword")}
                    placeholder={t("signup.confirmPassword")}
                    type={showConfirm ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    icon={<LockIcon />}
                    trailing={
                      <EyeToggle
                        shown={showConfirm}
                        onClick={() => setShowConfirm((v) => !v)}
                        label="confirm password"
                      />
                    }
                  />
                </Field>
              </div>

              <PrimaryButton
                type="submit"
                disabled={loading}
                aria-label="Sign up for a Retail AI customer account"
                className="mt-6 h-[54px] w-full rounded-[14px] text-base"
              >
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <span
                      aria-hidden
                      className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
                    />
                    {t("signup.creating")}
                  </span>
                ) : (
                  t("common.signUp")
                )}
              </PrimaryButton>

              <p className="mt-5 text-center text-sm text-brand-secondary-text">
                {t("signup.haveAccount")}{" "}
                <Link
                  to="/signin"
                  className="font-semibold text-brand-accent transition-colors hover:text-brand-teal"
                >
                  {t("common.signIn")}
                </Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}

export default SignUpScreen;
