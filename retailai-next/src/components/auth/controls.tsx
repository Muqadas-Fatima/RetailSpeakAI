"use client";
import {
  forwardRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

const base =
  "inline-flex min-h-12 items-center justify-center rounded-xl px-6 text-sm font-semibold transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-transparent sm:text-base";

export const PrimaryButton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        base,
        "bg-brand-gradient text-white hover:opacity-90 active:opacity-80 disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
      {...props}
    />
  ),
);
PrimaryButton.displayName = "PrimaryButton";

export const SecondaryButton = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, ...props }, ref) => (
  <button
    ref={ref}
    className={cn(
      base,
      "border border-brand-cyan/70 bg-transparent text-brand-on-dark transition-colors hover:bg-white/5",
      className,
    )}
    {...props}
  />
));
SecondaryButton.displayName = "SecondaryButton";

type InputFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  icon: ReactNode;
  label: string;
  trailing?: ReactNode;
};

export const InputField = forwardRef<HTMLInputElement, InputFieldProps>(
  ({ icon, label, trailing, className, id, ...props }, ref) => (
    <div className="relative">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <span
        aria-hidden
        className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-brand-muted"
      >
        {icon}
      </span>
      <input
        ref={ref}
        id={id}
        className={cn(
          "h-[54px] w-full rounded-[14px] border border-transparent bg-brand-surface-2/80 pl-12 pr-12 text-sm text-brand-ink placeholder:text-brand-muted focus:border-brand-teal focus:outline-none focus:ring-2 focus:ring-brand-teal/20 sm:text-base",
          className,
        )}
        {...props}
      />
      {trailing && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-muted">
          {trailing}
        </span>
      )}
    </div>
  ),
);
InputField.displayName = "InputField";

export function SocialLoginButton({
  icon,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { icon: ReactNode }) {
  return (
    <button
      className="flex min-h-[54px] w-full items-center gap-3 rounded-[14px] border border-brand-border bg-brand-card px-4 text-left text-sm font-semibold text-brand-ink transition-colors hover:border-brand-teal hover:bg-brand-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal sm:text-base"
      {...props}
    >
      <span className="shrink-0">{icon}</span>
      <span className="min-w-0 flex-1 truncate">{children}</span>
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        className="h-4 w-4 shrink-0 text-brand-secondary-text"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M5 12h14M13 6l6 6-6 6" />
      </svg>
    </button>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  id,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  id?: string;
}) {
  return (
    <label
      htmlFor={id}
      className="relative inline-flex h-7 w-12 cursor-pointer items-center rounded-full transition-colors focus-within:ring-2 focus-within:ring-brand-teal focus-within:ring-offset-2 focus-within:ring-offset-transparent"
      style={{ backgroundColor: checked ? "var(--brand-teal)" : "var(--brand-toggle-off)" }}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
      />
      <span
        className="inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform"
        style={{ transform: checked ? "translateX(1.4rem)" : "translateX(0.25rem)" }}
      />
      {label && <span className="sr-only">{label}</span>}
    </label>
  );
}

export function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden>
      <path
        fill="#4285F4"
        d="M45 24c0-1.6-.15-3.14-.42-4.6H24v8.7h11.8A10.1 10.1 0 0 1 31.2 34v6.1h6.6C41.7 36.6 45 31 45 24Z"
      />
      <path
        fill="#34A853"
        d="M24 46c5.94 0 10.93-1.96 14.57-5.32l-6.6-6.09C29.9 36.1 27.2 37 24 37c-6.2 0-11.45-4.1-13.33-9.68H3.9v6.32C7.6 41.1 15.2 46 24 46Z"
      />
      <path
        fill="#FBBC05"
        d="M10.67 27.32A13.6 13.6 0 0 1 10.67 20.7V14.4H3.9a22 22 0 0 0 0 19.2l6.77-6.28Z"
      />
      <path
        fill="#EA4335"
        d="M24 11c3.37 0 6.4 1.16 8.78 3.43l5.85-5.85C34.9 5.2 29.94 3 24 3 15.2 3 7.6 7.9 3.9 14.4l6.77 6.3C12.55 15.1 17.8 11 24 11Z"
      />
    </svg>
  );
}

export function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
      <circle cx="12" cy="12" r="12" fill="#1877F2" />
      <path
        fill="#fff"
        d="M15.1 12.3h-2v7h-2.9v-7H8.6V9.9h1.6V8.6c0-2 .84-3.1 3.1-3.1h1.9v2.4h-1.2c-.83 0-.9.31-.9.9v1.1h2.2l-.2 2.4Z"
      />
    </svg>
  );
}
