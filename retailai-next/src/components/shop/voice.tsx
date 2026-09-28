"use client";
import { Mic } from "lucide-react";
import { cn } from "@/lib/utils";

/** Bar heights for one side of the waveform; tallest bars sit next to the orb. */
const WAVE_BARS = [46, 30, 56, 22, 40, 64, 26, 50, 18, 36, 58, 24, 44, 16, 32, 12];

export function WaveBars({
  mirrored = false,
  tone = "navy",
}: {
  mirrored?: boolean;
  tone?: "navy" | "light";
}) {
  const bars = mirrored ? [...WAVE_BARS].reverse() : WAVE_BARS;
  return (
    <div
      aria-hidden
      className="flex min-w-0 flex-1 items-center justify-center gap-[3px] overflow-hidden lg:gap-1.5"
    >
      {bars.map((height, index) => (
        <span
          key={index}
          className={cn(
            "w-[2.5px] shrink-0 rounded-full origin-center lg:w-[4px] lg:scale-y-[2.4]",
            tone === "navy" ? "bg-brand-navy-deep/70 " : "bg-white/70",
          )}
          style={{ height: `${height}px` }}
        />
      ))}
    </div>
  );
}

/** The hero Voice Orb, matching the existing agent screen styling. */
export function VoiceOrb({
  label,
  onPress,
  size = "lg",
}: {
  label: string;
  onPress: () => void;
  size?: "lg" | "sm";
}) {
  const isLarge = size === "lg";
  return (
    <div className="relative grid shrink-0 place-items-center">
      <button
        type="button"
        onClick={onPress}
        aria-label={label}
        className={cn(
          "bg-voice-orb relative grid place-items-center rounded-full text-white shadow-[0_22px_44px_-16px_rgba(0,150,145,0.65)] transition-transform hover:scale-[1.03] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan focus-visible:ring-offset-2",
          isLarge ? "h-32 w-32 sm:h-36 sm:w-36 lg:h-40 lg:w-40" : "h-24 w-24",
        )}
      >
        <span className="flex flex-col items-center gap-1.5">
          <span className="text-[12px] font-bold tracking-wide text-white drop-shadow-sm lg:text-sm">
            {label}
          </span>
          <Mic className={cn(isLarge ? "h-9 w-9 lg:h-11 lg:w-11" : "h-7 w-7")} />
        </span>
      </button>
    </div>
  );
}
