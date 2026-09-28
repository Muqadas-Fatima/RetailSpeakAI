"use client";
/** Shared loading indicators for the Owner Portal. */
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function Spinner({ className }: { className?: string }) {
  return <Loader2 aria-hidden="true" className={cn("h-4 w-4 animate-spin", className)} />;
}

/** Inline "working…" row used beside titles during background refreshes. */
export function InlineLoading({ label = "Loading" }: { label?: string }) {
  return (
    <span
      role="status"
      className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-muted"
    >
      <Spinner className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}

/** Non-blocking overlay for a section that is being mutated. */
export function LoadingOverlay({ label = "Working" }: { label?: string }) {
  return (
    <div
      role="status"
      className="absolute inset-0 z-10 grid place-items-center rounded-2xl bg-white/70 backdrop-blur-sm "
    >
      <span className="inline-flex items-center gap-2 text-sm font-semibold text-brand-navy-deep ">
        <Spinner className="h-5 w-5" />
        {label}
      </span>
    </div>
  );
}
