"use client";

import { useNavigate } from "@/lib/router-compat";import { RetailAILogo } from "@/components/brand/RetailAILogo";
import { PrimaryButton, SecondaryButton } from "@/components/auth/controls";
import { useLanguage } from "@/lib/i18n";



function WelcomeScreen() {
  const navigate = useNavigate();
  const { t } = useLanguage();

  return (
    <main className="relative flex min-h-[100svh] flex-col overflow-hidden bg-gradient-to-br from-white via-brand-surface to-brand-aqua/25">
      {/* light upper area */}
      <div className="relative z-10 flex min-h-0 flex-1 items-center justify-center px-6 pb-[7svh] pt-[4svh] lg:pb-[5svh] lg:pt-[3svh]">
        {/* soft brand texture, bounded to the light area */}
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -right-[12%] top-[6%] aspect-square w-[46%] min-w-[220px] rounded-full bg-brand-aqua/25 blur-3xl" />
          <div className="absolute bottom-[-12%] left-[-10%] aspect-square w-[52%] min-w-[240px] rounded-full bg-brand-cyan/15 blur-3xl" />
          <div className="absolute bottom-0 left-0 h-[34%] w-full text-brand-cyan/20 brand-dots [mask-image:radial-gradient(120%_80%_at_40%_120%,black,transparent)]" />
          <svg
            className="absolute bottom-0 left-0 h-[40%] w-full text-brand-teal/15"
            viewBox="0 0 400 200"
            preserveAspectRatio="none"
            fill="none"
          >
            <path d="M0 150C90 90 210 180 400 60" stroke="currentColor" strokeWidth="1.2" />
            <path d="M0 178C110 122 220 186 400 104" stroke="currentColor" strokeWidth="1.2" />
          </svg>
        </div>
        <div className="relative z-10 w-full max-w-[1280px]">
          <h1 className="sr-only">Welcome to RetailAI</h1>
          <RetailAILogo className="text-[clamp(2.4rem,9.5vw,3.5rem)] lg:text-[clamp(2.5rem,3.5vw,3.55rem)]" />
        </div>
      </div>

      {/* dark navy welcome panel, anchored to the bottom edge */}
      <section className="relative z-10 flex min-h-[44svh] shrink-0 items-center rounded-t-[2rem] bg-brand-navy-deep px-6 pb-[max(2rem,env(safe-area-inset-bottom))] pt-8 sm:px-10 sm:pt-10 lg:min-h-[26svh] lg:rounded-t-[2.5rem] lg:px-14">
        <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-7 lg:flex-row lg:items-center lg:justify-between lg:gap-12">
          <div className="min-w-0 max-w-xl">
            <h2 className="text-[clamp(1.75rem,7vw,2rem)] font-bold leading-tight text-brand-on-dark lg:text-[2rem]">
              {t("welcome.title")}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-brand-on-dark/85 sm:text-base">
              {t("welcome.line1")}
              <br /> {t("welcome.line2")}
              <br /> {t("welcome.line3")}
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-3.5 sm:flex-row sm:justify-center sm:gap-4">
            <PrimaryButton
              className="w-full sm:w-40 lg:w-[8.5rem]"
              onClick={() => navigate({ to: "/signin" })}
            >
              {t("common.signIn")}
            </PrimaryButton>
            <SecondaryButton
              className="w-full sm:w-40 lg:w-[8.5rem]"
              onClick={() => navigate({ to: "/signup" })}
            >
              {t("common.signUp")}
            </SecondaryButton>
          </div>
        </div>
      </section>
    </main>
  );
}

export default WelcomeScreen;
