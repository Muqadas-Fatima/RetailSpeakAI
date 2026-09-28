"use client";
import { cn } from "@/lib/utils";

/** Teal/cyan quarter-circle + dotted/wave decoration used on the dark screens. */
export function DarkDecor({
  className,
  showTopCircle = true,
  showBottomCircle = true,
}: {
  className?: string;
  showTopCircle?: boolean;
  showBottomCircle?: boolean;
}) {
  return (
    <div
      aria-hidden
      className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}
    >
      {/* top-right quarter circle */}
      {showTopCircle && (
        <div className="absolute -right-[14%] -top-[10%] aspect-square w-[52%] min-w-[190px] rounded-full bg-brand-orb lg:-right-[6%] lg:-top-[14%] lg:w-[20%]" />
      )}
      {/* bottom-left quarter circle */}
      {showBottomCircle && (
        <div className="absolute -bottom-[10%] -left-[16%] aspect-square w-[48%] min-w-[176px] rounded-full bg-brand-orb lg:-bottom-[14%] lg:-left-[6%] lg:w-[19%]" />
      )}
      {/* dotted halftone */}
      <div className="absolute bottom-[6%] left-[12%] h-[36%] w-[52%] text-brand-cyan/20 brand-dots [mask-image:radial-gradient(closest-side,black,transparent)]" />
      {/* soft wave lines */}
      <svg
        className="absolute bottom-[8%] left-0 h-[38%] w-full text-brand-cyan/15"
        viewBox="0 0 400 200"
        preserveAspectRatio="none"
        fill="none"
      >
        <path d="M0 170C90 110 190 190 400 80" stroke="currentColor" strokeWidth="1.2" />
        <path d="M0 190C110 140 210 195 400 120" stroke="currentColor" strokeWidth="1.2" />
        <path d="M0 200C130 165 230 200 400 155" stroke="currentColor" strokeWidth="1.2" />
      </svg>
    </div>
  );
}

/** Aqua/cyan decoration for the light upper area of the Welcome screen. */
export function LightDecor({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}
    >
      <div className="absolute -right-[13%] -top-[16%] aspect-square w-[42%] min-w-[156px] rounded-full bg-brand-aqua/45 lg:-right-[6%] lg:-top-[18%] lg:w-[18%]" />
      <div className="absolute left-[4%] top-[10%] h-[45%] w-[26%] text-brand-cyan/25 brand-dots [mask-image:radial-gradient(closest-side,black,transparent)]" />
      {/* dotted wave band across the lower part of the light area */}
      <div className="absolute bottom-0 left-0 h-[42%] w-full text-brand-cyan/30 brand-dots [mask-image:radial-gradient(120%_80%_at_50%_120%,black,transparent)]" />
      <svg
        className="absolute bottom-0 left-0 h-[45%] w-full text-brand-cyan/25"
        viewBox="0 0 400 200"
        preserveAspectRatio="none"
        fill="none"
      >
        <path d="M0 150C90 90 210 180 400 70" stroke="currentColor" strokeWidth="1" />
        <path d="M0 175C110 120 220 185 400 110" stroke="currentColor" strokeWidth="1" />
        <path d="M0 198C130 155 240 198 400 150" stroke="currentColor" strokeWidth="1" />
      </svg>
    </div>
  );
}
