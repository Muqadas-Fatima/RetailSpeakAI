"use client";

import { useNavigate } from "@/lib/router-compat";import { useEffect } from "react";
import { RetailAILogo } from "@/components/brand/RetailAILogo";
import { DarkDecor } from "@/components/auth/decor";



function SplashScreen() {
  const navigate = useNavigate();

  useEffect(() => {
    const t = setTimeout(() => navigate({ to: "/welcome" }), 2400);
    return () => clearTimeout(t);
  }, [navigate]);

  return (
    <main className="relative flex min-h-[100svh] items-center justify-center overflow-hidden bg-brand-navy-deep">
      <DarkDecor />
      <button
        type="button"
        onClick={() => navigate({ to: "/welcome" })}
        aria-label="Continue to RetailAI"
        className="relative z-10 flex w-full max-w-[1280px] justify-center px-6 py-8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan"
      >
        <h1 className="sr-only">RetailAI — AI Voice Ordering</h1>
        <span
          className="text-[clamp(2.2rem,9vw,3.6rem)] lg:text-[clamp(3rem,4.35vw,4.1rem)]"
          style={{ ["--brand-ink" as string]: "#f4fafc" }}
        >
          <RetailAILogo className="text-[1em]" />
        </span>
      </button>
    </main>
  );
}

export default SplashScreen;
