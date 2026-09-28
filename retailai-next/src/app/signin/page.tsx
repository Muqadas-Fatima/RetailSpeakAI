"use client";

import { Link, useNavigate } from "@/lib/router-compat";import { useState } from "react";
import { toast } from "sonner";
import { DarkDecor } from "@/components/auth/decor";
import {
  FacebookIcon,
  GoogleIcon,
  InputField,
  PrimaryButton,
  SocialLoginButton,
} from "@/components/auth/controls";
import { useLanguage } from "@/lib/i18n";
import { isOwnerCredentials, setSession } from "@/lib/mock-accounts";



function SignInScreen() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [showPassword, setShowPassword] = useState(false);

  return (
    <main className="relative flex min-h-[100svh] flex-col overflow-hidden bg-brand-navy-deep">
      <DarkDecor showTopCircle={false} />

      {/* top bar */}
      <div className="relative z-20 mx-auto flex w-full max-w-[1280px] items-center px-4 pt-[max(1rem,env(safe-area-inset-top))] sm:px-8 sm:pt-6 lg:px-12">
        <button
          type="button"
          aria-label={t("common.back")}
          onClick={() => navigate({ to: "/welcome" })}
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
            {t("signin.title")}
          </h1>
          <p className="mt-2 max-w-[22rem] text-sm leading-relaxed text-brand-on-dark/80 sm:text-base">
            {t("signin.subtitle1")}
            <br /> {t("signin.subtitle2")}
          </p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            const username = String(formData.get("username") || "").trim();
            const password = String(formData.get("password") || "");
            if (isOwnerCredentials(username, password)) {
              setSession(username, "owner");
              toast.success(t("signin.toast.signedIn"));
              navigate({ to: "/owner" });
              return;
            }
            if (username) setSession(username);
            toast.success(t("signin.toast.signedIn"));
            navigate({ to: "/home" });
          }}
          className="mt-auto w-full rounded-t-[2rem] bg-white px-5 pb-[max(2rem,env(safe-area-inset-bottom))] pt-8 shadow-brand-card sm:px-8 sm:pt-9 lg:mx-auto lg:mt-0 lg:w-full lg:px-8 lg:pb-10 lg:pt-9"
        >
          <div className="flex flex-col gap-4">
            <InputField
              id="username"
              name="username"
              label={t("signin.username")}
              placeholder={t("signin.username")}
              autoComplete="username"
              icon={
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
              }
            />
            <InputField
              id="password"
              name="password"
              label={t("signin.password")}
              placeholder={t("signin.password")}
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              icon={
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
              }
              trailing={
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
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
                    {!showPassword && <path d="M4 20 20 4" />}
                  </svg>
                </button>
              }
            />
          </div>

          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={() => toast(t("signin.toast.forgot"))}
              className="rounded-md px-1 text-sm font-semibold text-brand-accent transition-colors hover:text-brand-teal"
            >
              {t("signin.forgot")}
            </button>
          </div>

          <PrimaryButton type="submit" className="mt-5 h-[54px] w-full rounded-[14px] text-base">
            {t("common.signIn")}
          </PrimaryButton>

          <div className="my-6 flex items-center gap-3">
            <span className="h-px flex-1 bg-brand-border" />
            <span className="text-xs text-brand-secondary-text sm:text-sm">
              {t("signin.divider")}
            </span>
            <span className="h-px flex-1 bg-brand-border" />
          </div>

          <div className="flex flex-col gap-3.5">
            <SocialLoginButton
              type="button"
              icon={<GoogleIcon />}
              onClick={() => toast(t("signin.toast.google"))}
            >
              {t("signin.google")}
            </SocialLoginButton>
            <SocialLoginButton
              type="button"
              icon={<FacebookIcon />}
              onClick={() => toast(t("signin.toast.facebook"))}
            >
              {t("signin.facebook")}
            </SocialLoginButton>
          </div>

          <p className="mt-5 text-center text-sm text-brand-secondary-text">
            {t("signin.noAccount")}{" "}
            <Link
              to="/signup"
              className="font-semibold text-brand-accent transition-colors hover:text-brand-teal"
            >
              {t("signin.signupLink")}
            </Link>
          </p>
        </form>
      </div>
    </main>
  );
}

export default SignInScreen;
