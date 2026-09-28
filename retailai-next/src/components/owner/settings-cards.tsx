"use client";
/**
 * Reusable setting-card building blocks.
 * Every control is props-driven so any settings screen can compose them without
 * duplicating layout, validation or save-footer logic.
 */
import { type ReactNode } from "react";
import { OwnerButton } from "@/components/owner/confirm-dialog";
import { Panel, PanelBody, PanelHeader } from "@/components/owner/primitives";
import { cn } from "@/lib/utils";

/** Card shell with an optional save/reset footer for a single settings section. */
export function SettingCard({
  title,
  description,
  children,
  dirty = false,
  saving = false,
  onSave,
  onReset,
}: {
  title: string;
  description?: string | undefined;
  children: ReactNode;
  dirty?: boolean | undefined;
  saving?: boolean | undefined;
  onSave?: (() => void) | undefined;
  onReset?: (() => void) | undefined;
}) {
  return (
    <Panel>
      <PanelHeader title={title} description={description} />
      <PanelBody className="space-y-4">{children}</PanelBody>
      {onSave ? (
        <footer className="flex flex-col-reverse gap-2 border-t border-brand-border-subtle px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <p className="text-xs text-brand-secondary-text ">
            {dirty ? "You have unsaved changes." : "All changes saved."}
          </p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            {onReset ? (
              <OwnerButton variant="secondary" onClick={onReset} disabled={!dirty}>
                Cancel
              </OwnerButton>
            ) : null}
            <OwnerButton onClick={onSave} disabled={!dirty} loading={saving}>
              Save changes
            </OwnerButton>
          </div>
        </footer>
      ) : null}
    </Panel>
  );
}

export function SettingRow({
  label,
  hint,
  htmlFor,
  error,
  children,
}: {
  label: string;
  hint?: string | undefined;
  htmlFor?: string | undefined;
  error?: string | undefined;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-1.5 sm:grid-cols-[minmax(0,240px)_minmax(0,1fr)] sm:items-start sm:gap-4">
      <div className="min-w-0">
        <label
          htmlFor={htmlFor}
          className="text-xs font-bold uppercase tracking-wide text-brand-muted"
        >
          {label}
        </label>
        {hint ? <p className="mt-0.5 text-xs text-brand-secondary-text ">{hint}</p> : null}
      </div>
      <div className="min-w-0">
        {children}
        {error ? <p className="mt-1 text-xs font-semibold text-brand-danger">{error}</p> : null}
      </div>
    </div>
  );
}

const FIELD_CLASS =
  "h-10 w-full rounded-xl border border-brand-border bg-white px-3 text-sm text-brand-navy-deep placeholder:text-brand-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan ";

export function TextSetting({
  id,
  label,
  value,
  onChange,
  hint,
  error,
  placeholder,
  type = "text",
  inputMode,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string | undefined;
  error?: string | undefined;
  placeholder?: string | undefined;
  type?: "text" | "email" | "tel" | "number";
  inputMode?: "numeric" | "text" | "tel" | "email" | undefined;
}) {
  return (
    <SettingRow label={label} hint={hint} htmlFor={id} error={error}>
      <input
        id={id}
        type={type}
        inputMode={inputMode}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={error ? true : undefined}
        className={cn(FIELD_CLASS, error && "border-destructive focus-visible:ring-destructive")}
      />
    </SettingRow>
  );
}

export function TextAreaSetting({
  id,
  label,
  value,
  onChange,
  hint,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string | undefined;
  placeholder?: string | undefined;
}) {
  return (
    <SettingRow label={label} hint={hint} htmlFor={id}>
      <textarea
        id={id}
        rows={3}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className={cn(FIELD_CLASS, "h-auto py-2")}
      />
    </SettingRow>
  );
}

export function SelectSetting({
  id,
  label,
  value,
  options,
  onChange,
  hint,
  placeholder = "Select an option",
}: {
  id: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  hint?: string | undefined;
  placeholder?: string | undefined;
}) {
  return (
    <SettingRow label={label} hint={hint} htmlFor={id}>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={FIELD_CLASS}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </SettingRow>
  );
}

/** Accessible switch used by every toggleable preference. */
export function ToggleSetting({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string | undefined;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-brand-border-subtle px-3 py-2.5 ">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-brand-navy-deep ">{label}</p>
        {description ? (
          <p className="mt-0.5 text-xs text-brand-secondary-text ">{description}</p>
        ) : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan focus-visible:ring-offset-2",
          checked ? "bg-brand-gradient" : "bg-brand-border ",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all",
            checked ? "start-[22px]" : "start-0.5",
          )}
        />
      </button>
    </div>
  );
}

/** Segmented option group (used for theme choice). */
export function SegmentedSetting<Value extends string>({
  label,
  value,
  options,
  onChange,
  hint,
}: {
  label: string;
  value: Value;
  options: { value: Value; label: string }[];
  onChange: (value: Value) => void;
  hint?: string | undefined;
}) {
  return (
    <SettingRow label={label} hint={hint}>
      <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
        {options.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(option.value)}
              className={cn(
                "rounded-xl border px-3 py-2 text-sm font-semibold transition-colors",
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
    </SettingRow>
  );
}
