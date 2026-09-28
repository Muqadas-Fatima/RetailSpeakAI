"use client";

import { Suspense } from "react";

import { useNavigate, useSearch } from "@/lib/router-compat";import { useState } from "react";
import { toast } from "sonner";
import { useLanguage } from "@/lib/i18n";
import { useCustomerProfile } from "@/lib/customer-profile";
import { isSignupFlow, validateFlowSearch, type FlowSearch } from "@/lib/onboarding";



/** Brand-gradient teardrop pin; its tip marks the exact center of the map. */
function MapPin() {
  return (
    <svg
      viewBox="0 0 48 66"
      aria-hidden
      overflow="visible"
      className="h-[3.75rem] w-auto -translate-y-1/2 drop-shadow-[0_12px_16px_rgba(7,27,51,0.35)] sm:h-[4.25rem]"
    >
      <defs>
        <linearGradient id="addressPin" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#00bfae" />
          <stop offset="1" stopColor="#16c7e8" />
        </linearGradient>
        <filter id="pinOutlineShadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="3" stdDeviation="2.5" floodColor="#071b33" floodOpacity="0.35" />
        </filter>
      </defs>
      <path
        d="M24 2C12.4 2 3 11.3 3 22.8 3 37.6 21 60.4 22.8 62.3a1.8 1.8 0 0 0 2.4 0C27 60.4 45 37.6 45 22.8 45 11.3 35.6 2 24 2Z"
        fill="url(#addressPin)"
        stroke="#071b33"
        strokeWidth="2.5"
        strokeLinejoin="round"
        filter="url(#pinOutlineShadow)"
      />
      <circle cx="24" cy="22.8" r="10.5" fill="#ffffff" stroke="#071b33" strokeWidth="2" />
      <circle cx="24" cy="22.8" r="5.25" fill="#00bfae" stroke="#071b33" strokeWidth="1.5" />
    </svg>
  );
}

function LocateIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="6.5" />
      <circle cx="12" cy="12" r="1.7" fill="currentColor" stroke="none" />
      <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.8-3.8" />
    </svg>
  );
}

function AddressScreen() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { update } = useCustomerProfile();
  const search = useSearch();
  const [address, setAddress] = useState("");
  const ready = address.trim().length > 0;

  const handleConfirm = () => {
    if (!ready) return;
    update({ address: address.trim() });
    toast.success(t("address.saved"));
    // Signup journey continues to email verification; otherwise back to Home.
    if (isSignupFlow(search)) {
      navigate({ to: "/verify-email", search: { flow: "signup" } });
      return;
    }
    navigate({ to: "/home" });
  };

  return (
    <main className="relative flex min-h-[100svh] flex-col overflow-hidden bg-brand-surface">
      {/* Full-screen map area (static placeholder — no maps integration) */}
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <img
          src={"/assets/map-terrain.jpg"}
          alt=""
          aria-hidden
          width={1920}
          height={1920}
          className="absolute inset-0 h-full w-full object-cover"
        />

        {/* Center pin */}
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <MapPin />
        </div>

        {/* Mini satellite preview */}
        <div className="absolute bottom-4 start-4 h-16 w-16 overflow-hidden rounded-xl border-2 border-white shadow-brand-card sm:bottom-5 sm:start-5 sm:h-[4.5rem] sm:w-[4.5rem]">
          <img
            src={"/assets/map-satellite.jpg"}
            alt={t("address.satelliteAlt")}
            width={512}
            height={512}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        </div>

        {/* Floating current-location button (placeholder) */}
        <button
          type="button"
          aria-label={t("address.locate")}
          onClick={() => toast(t("address.locateMock"))}
          className="absolute bottom-4 end-4 grid h-12 w-12 place-items-center rounded-full bg-white text-brand-accent shadow-brand-card transition-transform hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan sm:bottom-5 sm:end-5"
        >
          <LocateIcon />
        </button>
      </div>

      {/* Bottom sheet */}
      <section className="relative z-10 rounded-t-[28px] bg-brand-navy-deep px-6 pt-7 pb-[max(2.25rem,env(safe-area-inset-bottom))] shadow-[0_-18px_44px_-18px_rgba(7,27,51,0.55)]">
        <form
          className="mx-auto w-full max-w-xl"
          onSubmit={(event) => {
            event.preventDefault();
            handleConfirm();
          }}
        >
          <h1 className="text-[1.375rem] font-extrabold leading-snug tracking-tight text-white">
            {t("address.title")}
          </h1>

          <label className="mt-5 flex h-14 items-center gap-3 rounded-2xl bg-white/10 px-5 text-brand-on-dark transition-shadow focus-within:ring-2 focus-within:ring-brand-cyan/60">
            <SearchIcon />
            <input
              type="text"
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              placeholder={t("address.placeholder")}
              autoComplete="street-address"
              className="h-full min-w-0 flex-1 bg-transparent text-[15px] font-medium text-white placeholder:font-normal placeholder:text-white/60 focus:outline-none"
            />
          </label>

          <div aria-hidden className="my-5 h-px w-full bg-white/15" />

          <button
            type="submit"
            className="h-14 w-full rounded-2xl bg-brand-cta text-base font-bold text-white shadow-[0_18px_34px_-14px_rgba(10,150,190,0.6)] transition-all hover:opacity-95 active:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan focus-visible:ring-offset-2"
          >
            {t("address.confirm")}
          </button>
        </form>
      </section>
    </main>
  );
}

export default function AddressScreenPage() {
  return (
    <Suspense fallback={null}>
      <AddressScreen />
    </Suspense>
  );
}

