"use client";
/**
 * Reusable responsive filter UI for the Owner Portal.
 * Every control is stateless: options and values arrive through props so a
 * future API can supply statuses, suppliers, categories and roles unchanged.
 */
import { Filter, X } from "lucide-react";
import { type ReactNode, useId } from "react";
import { cn } from "@/lib/utils";

export type FilterOption = { value: string; label: string };

/** Responsive toolbar: search slot + wrapping filter controls + reset. */
export function FilterBar({
  search,
  children,
  onReset,
  activeCount = 0,
}: {
  search?: ReactNode;
  children?: ReactNode;
  onReset?: (() => void) | undefined;
  activeCount?: number;
}) {
  return (
    <div className="grid gap-3 border-b border-brand-border-subtle px-4 py-3.5 sm:px-5">
      {search ? <div className="w-full sm:max-w-sm">{search}</div> : null}
      {children ? (
        <div className="flex flex-wrap items-end gap-6">
          <span className="hidden items-center gap-1.5 self-center text-xs font-semibold text-brand-muted sm:inline-flex">
            <Filter className="h-3.5 w-3.5" aria-hidden="true" />
            Filters
          </span>
          {children}
          {onReset && activeCount > 0 ? (
            <button
              type="button"
              onClick={onReset}
              className="inline-flex h-9 items-center gap-1.5 self-center rounded-xl px-2.5 text-xs font-semibold text-brand-accent transition-colors hover:bg-brand-surface-2 "
            >
              <X className="h-3.5 w-3.5" />
              Reset ({activeCount})
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function SelectFilter({
  label,
  value,
  options,
  onChange,
  allLabel = "All",
  className,
}: {
  label: string;
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
  allLabel?: string | undefined;
  className?: string | undefined;
}) {
  const id = useId();
  return (
    <div className={cn("min-w-0 grow basis-40 sm:grow-0", className)}>
      <label
        htmlFor={id}
        className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-brand-muted"
      >
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 w-full rounded-xl border border-brand-border bg-white px-2.5 text-sm font-medium text-brand-navy-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan sm:w-44"
      >
        <option value="">{allLabel}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function DateFilter({
  label,
  value,
  onChange,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string | undefined;
}) {
  const id = useId();
  return (
    <div className={cn("min-w-0 grow basis-40 sm:grow-0", className)}>
      <label
        htmlFor={id}
        className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-brand-muted"
      >
        {label}
      </label>
      <input
        id={id}
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 w-full rounded-xl border border-brand-border bg-white px-2.5 text-sm font-medium text-brand-navy-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan sm:w-40"
      />
    </div>
  );
}

/** Scrollable chip row — used for quick status switching on mobile. */
export function ChipFilter({
  label,
  value,
  options,
  onChange,
  allLabel = "All",
}: {
  label: string;
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
  allLabel?: string | undefined;
}) {
  const all: FilterOption[] = [{ value: "", label: allLabel }, ...options];
  return (
    <div className="min-w-0 grow">
      <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-brand-muted">
        {label}
      </span>
      <div role="group" aria-label={label} className="scroll-rail -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {all.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={option.value || "all"}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(option.value)}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                active
                  ? "border-transparent bg-brand-gradient text-white"
                  : "border-brand-border bg-white text-brand-secondary-text hover:bg-brand-surface-2 ",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Multi-select via toggleable chips; value is an array of option values. */
export function MultiSelectFilter({
  label,
  values,
  options,
  onChange,
}: {
  label: string;
  values: string[];
  options: FilterOption[];
  onChange: (values: string[]) => void;
}) {
  const toggle = (option: string) =>
    onChange(
      values.includes(option) ? values.filter((item) => item !== option) : [...values, option],
    );

  return (
    <div className="min-w-0 grow">
      <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-brand-muted">
        {label}
      </span>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => {
          const active = values.includes(option.value);
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              onClick={() => toggle(option.value)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                active
                  ? "border-brand-teal bg-brand-teal/12 text-brand-accent"
                  : "border-brand-border bg-white text-brand-secondary-text hover:bg-brand-surface-2 ",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
