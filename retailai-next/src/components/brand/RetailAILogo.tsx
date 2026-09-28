"use client";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  showWordmark?: boolean;
};

/**
 * Single source of truth for the RetailAI logo.
 * Fixed brand colors — cyan/teal speech-bubble + waveform, dark navy microphone
 * details, navy "Retail" + cyan "Ai" wordmark and the "AI VOICE ORDERING"
 * subtitle framed by cyan rules. NEVER recolor per screen or background.
 */
export function RetailAIMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 120"
      role="img"
      aria-label="RetailAI logo mark"
      className={cn("block", className)}
    >
      {/* speech bubble ring */}
      <path
        d="M60 8c28.7 0 52 21.5 52 48s-23.3 48-52 48c-6.4 0-12.5-1-18.2-3L22 111.5c-2.4.9-4.8-1.5-4-3.9l5.4-16.3C13.4 82.6 8 70.5 8 56 8 29.5 31.3 8 60 8Z"
        fill="none"
        stroke="var(--brand-cyan)"
        strokeWidth="6"
        strokeLinejoin="round"
      />
      {/* waveform bars */}
      <g stroke="var(--brand-cyan)" strokeWidth="4.5" strokeLinecap="round">
        <line x1="26" y1="50" x2="26" y2="62" />
        <line x1="35" y1="43" x2="35" y2="69" />
        <line x1="85" y1="43" x2="85" y2="69" />
        <line x1="94" y1="50" x2="94" y2="62" />
      </g>
      {/* microphone — dark navy details */}
      <g>
        <rect
          x="51"
          y="24"
          width="18"
          height="40"
          rx="9"
          fill="none"
          stroke="var(--brand-ink)"
          strokeWidth="5"
        />
        <g stroke="var(--brand-ink)" strokeWidth="3" strokeLinecap="round">
          <line x1="55" y1="34" x2="65" y2="34" />
          <line x1="55" y1="42" x2="65" y2="42" />
          <line x1="55" y1="50" x2="65" y2="50" />
        </g>
        <path
          d="M43 56c0 9.4 7.6 17 17 17s17-7.6 17-17"
          fill="none"
          stroke="var(--brand-ink)"
          strokeWidth="5"
          strokeLinecap="round"
        />
        <line
          x1="60"
          y1="73"
          x2="60"
          y2="86"
          stroke="var(--brand-ink)"
          strokeWidth="5"
          strokeLinecap="round"
        />
        <line
          x1="48"
          y1="88"
          x2="72"
          y2="88"
          stroke="var(--brand-ink)"
          strokeWidth="5"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}

export function RetailAILogo({ className, showWordmark = true }: Props) {
  return (
    // Brand wordmark order is fixed LTR even when the app is in RTL (Urdu) mode.
    <div dir="ltr" className={cn("flex flex-col items-center", className)}>
      <RetailAIMark className="h-[1.9em] w-[1.9em]" />
      {showWordmark && (
        <>
          <div
            className="mt-[0.28em] flex items-baseline font-bold leading-none tracking-tight text-brand-ink"
            style={{ fontSize: "1em" }}
          >
            <span>Retail</span>
            <span className="text-brand-cyan">Ai</span>
          </div>
          <div className="mt-[0.34em] flex items-center gap-[0.5em]">
            <span className="h-px w-[1.1em] bg-brand-cyan" />
            <span
              className="shrink-0 whitespace-nowrap font-semibold uppercase leading-none text-brand-ink"
              style={{ fontSize: "0.235em", letterSpacing: "0.22em" }}
            >
              AI Voice Ordering
            </span>
            <span className="h-px w-[1.1em] bg-brand-cyan" />
          </div>
        </>
      )}
    </div>
  );
}
