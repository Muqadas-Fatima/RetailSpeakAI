"use client";
/** Labelled select built on the shared FilterOption shape (form use, not filtering). */
import type { FilterOption } from "@/components/owner/filters";
import { cn } from "@/lib/utils";

export function FilterOptionSelect({
  id,
  label,
  value,
  options,
  onChange,
  error,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
  error?: string | undefined;
  /** Rendered as a disabled first option when no value is selected. */
  placeholder?: string | undefined;
}) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={id}
        className="block text-xs font-bold uppercase tracking-wide text-brand-muted"
      >
        {label}
      </label>
      <select
        id={id}
        value={value}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          "w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm font-medium text-brand-navy-deep outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand-cyan ",
          error ? "border-destructive" : "border-brand-border ",
        )}
      >
        {placeholder ? (
          <option value="" disabled>
            {placeholder}
          </option>
        ) : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error ? (
        <p id={`${id}-error`} className="text-xs font-semibold text-brand-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
