"use client";

import { Suspense } from "react";

import { useNavigate, useSearch } from "@/lib/router-compat";import { useEffect, useMemo, useRef, useState } from "react";
import authData from "@/data/auth.json";
import { clearPendingSignup, getPendingSignup, validateFlowSearch, type FlowSearch } from "@/lib/onboarding";
import { setSession } from "@/lib/mock-accounts";
import { toast } from "sonner";

import { PrimaryButton } from "@/components/auth/controls";

import { cn } from "@/lib/utils";



/** Mock verification config — swap for the signup response / session API. */
const { fallbackEmail: FALLBACK_EMAIL, otpLength: OTP_LENGTH, resendSeconds: RESEND_SECONDS } =
  authData.verification;

function formatTimer(total: number) {
  const m = Math.floor(total / 60)
    .toString()
    .padStart(2, "0");
  const s = (total % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function VerifyEmailScreen() {
  const navigate = useNavigate();
  const search = useSearch();
  // Email comes from the centralized pending-signup state, never hardcoded here.
  const [email, setEmail] = useState(FALLBACK_EMAIL);
  useEffect(() => {
    const pending = getPendingSignup();
    if (pending?.email) setEmail(pending.email);
  }, []);
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const [verified, setVerified] = useState(false);
  const [seconds, setSeconds] = useState(RESEND_SECONDS);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (seconds <= 0) return;
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds]);

  useEffect(() => {
    inputsRef.current[0]?.focus();
  }, []);

  const codeComplete = useMemo(() => digits.every((d) => d !== ""), [digits]);

  function setDigit(index: number, value: string) {
    const clean = value.replace(/\D/g, "");
    if (!clean && value !== "") return;
    setError(null);
    setDigits((prev) => {
      const next = [...prev];
      if (clean.length > 1) {
        const chars = clean.slice(0, OTP_LENGTH).split("");
        for (let i = 0; i < OTP_LENGTH; i++) {
          next[i] = chars[i] ?? "";
        }
        const lastFilled = Math.min(chars.length, OTP_LENGTH) - 1;
        setTimeout(() => {
          inputsRef.current[Math.min(lastFilled + 1, OTP_LENGTH - 1)]?.focus();
        }, 0);
        return next;
      }
      next[index] = clean;
      return next;
    });
    if (clean.length === 1 && index < OTP_LENGTH - 1) {
      setTimeout(() => inputsRef.current[index + 1]?.focus(), 0);
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace") {
      if (digits[index]) {
        setError(null);
        setDigits((prev) => {
          const next = [...prev];
          next[index] = "";
          return next;
        });
      } else if (index > 0) {
        inputsRef.current[index - 1]?.focus();
        setDigits((prev) => {
          const next = [...prev];
          next[index - 1] = "";
          return next;
        });
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      e.preventDefault();
      inputsRef.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < OTP_LENGTH - 1) {
      e.preventDefault();
      inputsRef.current[index + 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LENGTH);
    if (!text) return;
    setError(null);
    const chars = text.split("");
    setDigits(() => {
      const next = Array(OTP_LENGTH).fill("");
      for (let i = 0; i < chars.length; i++) next[i] = chars[i];
      return next;
    });
    const focusIdx = Math.min(chars.length, OTP_LENGTH - 1);
    setTimeout(() => inputsRef.current[focusIdx]?.focus(), 0);
  }

  function triggerError(message: string) {
    setError(message);
    setShake(true);
    setTimeout(() => setShake(false), 500);
  }

  function handleVerify() {
    if (verified) return;
    if (!codeComplete) {
      triggerError("Please enter the complete 6-digit code");
      return;
    }
    setVerified(true);
    setError(null);
  }

  function handleResend() {
    if (seconds > 0) return;
    setSeconds(RESEND_SECONDS);
    setDigits(Array(OTP_LENGTH).fill(""));
    setError(null);
    inputsRef.current[0]?.focus();
    toast.success("A new code has been sent", { description: email });
  }

  return (
    <main className="relative flex min-h-[100svh] flex-col overflow-x-hidden bg-gradient-to-br from-white via-brand-surface to-brand-aqua/25">
      {/* soft brand texture */}
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

      {/* back */}
      <div className="relative z-20 mx-auto flex w-full max-w-[1280px] items-center px-5 pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-8 sm:pt-6 lg:px-12">
        <button
          type="button"
          onClick={() =>
            search.flow === "signup"
              ? navigate({ to: "/address", search: { flow: "signup" } })
              : navigate({ to: "/signin" })
          }
          className="-ml-2 flex min-h-[44px] items-center gap-2 rounded-full px-3 text-sm font-semibold text-brand-ink transition-colors hover:bg-white/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M19 12H5M11 18l-6-6 6-6" />
          </svg>
          Back
        </button>
      </div>

      {/* content */}
      <div className="relative z-10 mx-auto flex w-full max-w-[1280px] flex-1 items-center justify-center px-5 pb-6 pt-4 sm:px-8 lg:px-12">
        <div className="grid w-full grid-cols-1 items-center gap-10 lg:grid-cols-[1fr_minmax(0,480px)] lg:gap-16 xl:gap-24">
          {/* brand panel — desktop only */}
          <section className="hidden flex-col lg:flex">
            <h2 className="mt-10 text-[clamp(1.9rem,3.2vw,2.5rem)] font-bold leading-tight text-brand-ink">
              One last step to unlock
              <br />
              your smart storefront
            </h2>
            <p className="mt-4 max-w-md text-base leading-relaxed text-brand-secondary-text">
              Confirm your email address to enable AI-powered ordering, live tracking, and everything
              RetailAI has to offer.
            </p>
            <ul className="mt-9 space-y-5 text-[0.95rem] font-medium text-brand-ink">
              <li className="flex items-center gap-4">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-teal/12 text-brand-teal">
                  <svg
                    viewBox="0 0 24 24"
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 3l7 3v6c0 4.4-3 7.6-7 9-4-1.4-7-4.6-7-9V6l7-3z" />
                    <path d="M9.5 12l2 2 3.5-3.5" />
                  </svg>
                </span>
                Secure account verification
              </li>
              <li className="flex items-center gap-4">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-cyan/12 text-brand-cyan">
                  <svg
                    viewBox="0 0 24 24"
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="3" y="5" width="18" height="14" rx="2" />
                    <path d="M3 9h18" />
                  </svg>
                </span>
                Trusted by thousands of stores
              </li>
              <li className="flex items-center gap-4">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-aqua/20 text-brand-accent">
                  <svg
                    viewBox="0 0 24 24"
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M13 2L3 14h7v8l10-12h-7V2z" />
                  </svg>
                </span>
                Lightning-fast checkout experience
              </li>
            </ul>
          </section>

          {/* right column */}
          <div className="w-full">
            <div className="mx-auto mt-7 w-full max-w-[480px] rounded-[24px] bg-white/85 px-5 py-8 shadow-brand-card backdrop-blur-md sm:px-9 sm:py-10 lg:mt-0">
              {!verified ? (
                <>
                  <div className="flex justify-center">
                    <EnvelopeIllustration />
                  </div>

                  <h1 className="mt-5 text-center text-[clamp(1.45rem,5.5vw,1.8rem)] font-bold leading-tight text-brand-ink">
                    Verify your email
                  </h1>
                  <p className="mt-2 text-center text-sm leading-relaxed text-brand-secondary-text">
                    We sent a 6-digit code to
                    <br />
                    <span className="font-semibold text-brand-accent">{email}</span>
                  </p>

                  <div
                    className={cn(
                      "mt-6 flex items-center justify-between gap-1.5 sm:gap-2.5",
                      shake && "otp-shake",
                    )}
                  >
                    {digits.map((d, i) => (
                      <input
                        key={i}
                        ref={(el) => {
                          inputsRef.current[i] = el;
                        }}
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        maxLength={1}
                        value={d}
                        placeholder="-"
                        aria-label={`Digit ${i + 1} of ${OTP_LENGTH}`}
                        onChange={(e) => setDigit(i, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(i, e)}
                        onPaste={handlePaste}
                        onFocus={() => setActiveIndex(i)}
                        onBlur={() => setActiveIndex((cur) => (cur === i ? null : cur))}
                        className={cn(
                          "h-12 w-full min-w-0 rounded-xl border bg-white text-center text-lg font-bold text-brand-ink transition-all placeholder:font-normal placeholder:text-brand-muted focus:outline-none focus:ring-2 sm:h-14 sm:text-xl",
                          error
                            ? "border-brand-danger/70 focus:border-brand-danger focus:ring-brand-danger/20"
                            : activeIndex === i
                              ? "border-brand-teal ring-brand-teal/25"
                              : d
                                ? "border-brand-teal/50"
                                : "border-brand-ink/15 hover:border-brand-teal/40",
                        )}
                      />
                    ))}
                  </div>

                  {error && (
                    <p className="mt-3 text-center text-sm font-medium text-brand-danger">{error}</p>
                  )}

                  <PrimaryButton
                    type="button"
                    onClick={handleVerify}
                    className="mt-6 flex h-[52px] w-full items-center justify-center gap-2 rounded-[14px] text-base"
                  >
                    <span>Verify</span>
                    <svg
                      viewBox="0 0 24 24"
                      className="h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden
                    >
                      <path d="M5 12h14M13 6l6 6-6 6" />
                    </svg>
                  </PrimaryButton>

                  {/* or divider */}
                  <div className="mt-5 flex items-center gap-4">
                    <span className="h-px flex-1 bg-brand-ink/10" />
                    <span className="text-xs font-medium text-brand-secondary-text">or</span>
                    <span className="h-px flex-1 bg-brand-ink/10" />
                  </div>

                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={seconds > 0}
                    className={cn(
                      "mt-5 flex h-[52px] w-full items-center justify-center gap-2 rounded-[14px] border text-sm font-semibold transition-colors",
                      seconds > 0
                        ? "cursor-not-allowed border-brand-ink/10 text-brand-muted"
                        : "border-brand-teal/60 text-brand-accent hover:bg-brand-teal/8",
                    )}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className="h-4.5 w-4.5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden
                    >
                      <circle cx="12" cy="12" r="9" />
                      <path d="M12 8v4l3 2" />
                    </svg>
                    {seconds > 0 ? `Resend code (${formatTimer(seconds)})` : "Resend code"}
                  </button>

                  <div className="mt-4 flex justify-center">
                    <button
                      type="button"
                      onClick={() => navigate({ to: "/signup" })}
                      className="min-h-[44px] text-sm font-semibold text-brand-ink underline-offset-2 transition-colors hover:text-brand-accent hover:underline"
                    >
                      Change email
                    </button>
                  </div>
                </>
              ) : (
                <SuccessState
                  onContinue={() => {
                    setSessionAfterVerify(email);
                    navigate({ to: "/home" });
                  }}
                />
              )}
            </div>

            {/* reassurance footer */}
            <p className="mt-6 flex items-center justify-center gap-2 px-4 text-center text-xs leading-relaxed text-brand-secondary-text sm:text-sm">
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4 shrink-0"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <rect x="4" y="11" width="16" height="9" rx="2" />
                <path d="M8 11V8a4 4 0 018 0v3" />
              </svg>
              Your information is safe with us. We never share your email.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}

function EnvelopeIllustration() {
  return (
    <div className="relative">
      <svg viewBox="0 0 120 96" className="h-24 w-30 sm:h-28" fill="none" aria-hidden>
        <rect x="14" y="24" width="92" height="60" rx="8" fill="#F1F8FA" />
        <path d="M14 32c0-4.4 3.6-8 8-8h76c4.4 0 8 3.6 8 8L60 66 14 32z" fill="var(--brand-cyan)" />
        <path d="M14 32L60 66l46-34" fill="none" stroke="var(--brand-ink)" strokeWidth="2" />
        <rect
          x="14"
          y="24"
          width="92"
          height="60"
          rx="8"
          fill="none"
          stroke="var(--brand-ink)"
          strokeOpacity="0.35"
          strokeWidth="2"
        />
        <circle cx="97" cy="72" r="12" fill="#FFFFFF" />
        <circle cx="97" cy="72" r="11" fill="none" stroke="var(--brand-ink)" strokeWidth="2.5" />
        <path
          d="M92 72.5l3.5 3.5L102 69"
          stroke="var(--brand-ink)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="absolute left-1 top-4 text-brand-cyan/70">
        <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="currentColor" aria-hidden>
          <path d="M6 0l1.2 4.8L12 6l-4.8 1.2L6 12 4.8 7.2 0 6l4.8-1.2z" />
        </svg>
      </span>
      <span className="absolute right-2 top-1 text-brand-teal/60">
        <svg viewBox="0 0 12 12" className="h-2 w-2" fill="currentColor" aria-hidden>
          <path d="M6 0l1.2 4.8L12 6l-4.8 1.2L6 12 4.8 7.2 0 6l4.8-1.2z" />
        </svg>
      </span>
    </div>
  );
}

function setSessionAfterVerify(email: string) {
  try {
    setSession(email);
    clearPendingSignup();
  } catch {
    /* storage unavailable in this prototype */
  }
}

function SuccessState({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="check-circle grid h-20 w-20 place-items-center rounded-full bg-brand-teal/12">
        <svg viewBox="0 0 52 52" className="h-12 w-12" fill="none" aria-hidden>
          <circle cx="26" cy="26" r="24" stroke="var(--brand-teal)" strokeWidth="3" />
          <path
            className="check-mark"
            d="M15 27l7.5 7.5L37 19"
            stroke="var(--brand-teal)"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <h2 className="mt-5 text-[clamp(1.3rem,5.5vw,1.6rem)] font-bold leading-tight text-brand-ink">
        Email verified successfully
      </h2>
      <p className="mt-2 max-w-xs text-sm leading-relaxed text-brand-secondary-text">
        Your email has been confirmed. You're all set to start ordering with RetailAI.
      </p>
      <PrimaryButton
        type="button"
        onClick={onContinue}
        className="mt-6 h-[52px] w-full rounded-[14px] text-base"
      >
        Continue
      </PrimaryButton>
    </div>
  );
}

export default function VerifyEmailScreenPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailScreen />
    </Suspense>
  );
}

