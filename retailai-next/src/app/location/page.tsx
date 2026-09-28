"use client";

import { Suspense } from "react";

import { useNavigate, useSearch } from "@/lib/router-compat";import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { useLanguage } from "@/lib/i18n";
import { validateFlowSearch, type FlowSearch } from "@/lib/onboarding";



/** Extremely subtle cyan dots on the left + soft wave lines on the lower-right. */
function LocationDecor() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute -left-[6%] top-[14%] h-[36%] w-[30%] text-brand-cyan/20 brand-dots [mask-image:radial-gradient(closest-side,black,transparent)]" />
      <svg
        className="absolute bottom-[3%] right-0 h-[20%] w-[70%] text-brand-cyan/15"
        viewBox="0 0 400 160"
        preserveAspectRatio="none"
        fill="none"
      >
        <path d="M0 130C110 80 220 150 400 60" stroke="currentColor" strokeWidth="1" />
        <path d="M0 150C130 105 240 158 400 95" stroke="currentColor" strokeWidth="1" />
      </svg>
    </div>
  );
}

function MapPinIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 21.2s-6.8-5.3-6.8-10.4a6.8 6.8 0 1 1 13.6 0c0 5.1-6.8 10.4-6.8 10.4Z" />
      <circle cx="12" cy="10.6" r="2.4" />
    </svg>
  );
}

function FastTruckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M10 16.2V7H4v9.2" />
      <path d="M10 10h4.4l3.1 3.2v3h-2" />
      <path d="M10 16.2h2.4" />
      <circle cx="7" cy="17.6" r="1.6" />
      <circle cx="14.9" cy="17.6" r="1.6" />
      <path d="M1.4 9.6h2.2M1 12.4h3M1.4 15.2h2.2" />
    </svg>
  );
}

function BenefitRow({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-4">
      <span
        aria-hidden
        className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-brand-aqua/30 text-brand-navy-deep "
      >
        {icon}
      </span>
      <div className="min-w-0">
        <h2 className="text-[15px] font-bold leading-snug text-brand-navy-deep sm:text-base lg:text-[17px]">
          {title}
        </h2>
        <p className="mt-1 text-[13px] leading-relaxed text-brand-secondary-text sm:text-sm lg:text-[15px]">
          {description}
        </p>
      </div>
    </div>
  );
}

function LocationPermissionScreen() {
  const navigate = useNavigate();
  const search = useSearch();
  const { t } = useLanguage();
  const [requesting, setRequesting] = useState(false);

  const finish = (result: "granted" | "denied" | "unavailable") => {
    try {
      window.localStorage.setItem("retailai.location.permission", result);
    } catch {
      /* storage unavailable in this prototype */
    }
    if (result === "granted") toast.success(t("location.granted"));
    else if (result === "denied") toast.error(t("location.denied"));
    else toast.error(t("location.unavailable"));
    setRequesting(false);
    navigate({ to: "/address", search });
  };

  const handleContinue = () => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      finish("unavailable");
      return;
    }
    setRequesting(true);
    navigator.geolocation.getCurrentPosition(
      () => finish("granted"),
      () => finish("denied"),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  };

  return (
    <main className="relative flex min-h-[100svh] flex-col overflow-hidden bg-brand-surface">
      <LocationDecor />

      <div className="relative z-10 mx-auto flex w-full max-w-[27rem] flex-1 flex-col px-6 pt-[max(0.9rem,env(safe-area-inset-top))] sm:px-8 lg:max-w-6xl lg:grid lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:items-center lg:gap-14 lg:px-14 lg:py-8 lg:pt-8 xl:max-w-7xl xl:gap-20 2xl:max-w-[88rem]">
        {/* illustration */}
        <div className="grid min-h-0 flex-1 place-items-center py-3 max-lg:[@media(max-height:720px)]:py-1 lg:order-2 lg:h-full lg:py-6">
          <img
            src={"/assets/location-hero.png"}
            alt="RetailAI voice assistant robot beside a teal location pin on a stylized map"
            width={1024}
            height={960}
            className="max-h-[44svh] w-auto max-w-full object-contain max-lg:[@media(max-height:720px)]:max-h-[30svh] lg:max-h-[min(76vh,44rem)] lg:w-full lg:max-w-[46rem] 2xl:max-w-[52rem]"
          />
        </div>

        {/* left content column on desktop; transparent wrapper (contents) on mobile/tablet */}
        <div className="contents lg:order-1 lg:flex lg:w-full lg:max-w-[30rem] lg:flex-col lg:justify-center lg:self-center">
          {/* heading */}
          <h1 className="text-[clamp(1.6rem,2.6vw+1rem,1.85rem)] font-extrabold leading-[1.28] tracking-tight text-brand-navy-deep lg:text-[clamp(1.9rem,2.2vw+0.7rem,2.6rem)] lg:leading-[1.22]">
            {t("location.headingA")}{" "}
            <span className="text-brand-accent">{t("location.headingB")}</span>{" "}
            {t("location.headingC")}
          </h1>

          {/* benefits */}
          <div className="mt-7 flex flex-col max-lg:[@media(max-height:720px)]:mt-4 lg:mt-10">
            <BenefitRow
              icon={<MapPinIcon />}
              title={t("location.benefit1.title")}
              description={t("location.benefit1.desc")}
            />
            <div
              aria-hidden
              className="my-5 h-px w-full bg-brand-border max-lg:[@media(max-height:720px)]:my-3 lg:my-7"
            />
            <BenefitRow
              icon={<FastTruckIcon />}
              title={t("location.benefit2.title")}
              description={t("location.benefit2.desc")}
            />
          </div>

          {/* continue + home indicator */}
          <div className="pb-[max(0.6rem,env(safe-area-inset-bottom))] pt-8 max-lg:[@media(max-height:720px)]:pt-4 lg:pb-0 lg:pt-11">
            <button
              type="button"
              onClick={handleContinue}
              disabled={requesting}
              className="inline-flex h-14 w-full items-center justify-center rounded-2xl bg-brand-cta text-base font-bold text-white shadow-[0_18px_34px_-14px_rgba(10,150,190,0.6)] transition-opacity hover:opacity-95 active:opacity-85 disabled:cursor-not-allowed disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
            >
              {requesting ? (
                <span className="inline-flex items-center gap-2">
                  <span
                    aria-hidden
                    className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
                  />
                  {t("location.requesting")}
                </span>
              ) : (
                t("location.continue")
              )}
            </button>
            <div
              aria-hidden
              className="mx-auto mt-4 h-[5px] w-32 rounded-full bg-brand-navy-deep/85 lg:hidden"
            />
          </div>
        </div>
      </div>
    </main>
  );
}

export default function LocationPermissionScreenPage() {
  return (
    <Suspense fallback={null}>
      <LocationPermissionScreen />
    </Suspense>
  );
}

