"use client";
import { Check, Info, Lock } from "lucide-react";
import { useMemo } from "react";
import { StatusPill } from "@/components/owner/primitives";
import {
  PERMISSION_ACTIONS,
  PERMISSION_MODULES,
  type PermissionKey,
  actionLabel,
  dependenciesFor,
  moduleLabel,
  permissionKey,
  togglePermission,
} from "@/lib/owner/permissions";
import { cn } from "@/lib/utils";

type MatrixProps = {
  value: PermissionKey[];
  onChange: (next: PermissionKey[]) => void;
  /** Owner accounts are always full-access: matrix renders locked. */
  readOnly?: boolean | undefined;
  /** Called when a dependency was auto-enabled, so the page can toast. */
  onDependencyApplied?: ((message: string) => void) | undefined;
};

/**
 * Generic module × action permission matrix. Modules and actions come from the
 * permission registry, so new modules/actions appear here with no code change.
 * Desktop renders a table; mobile renders per-module cards with the same state.
 */
export function PermissionMatrix({ value, onChange, readOnly, onDependencyApplied }: MatrixProps) {
  const enabled = useMemo(() => new Set(value), [value]);

  const toggle = (moduleId: string, action: string) => {
    if (readOnly) return;
    const key = permissionKey(moduleId, action as never);
    const isOn = enabled.has(key);
    const next = togglePermission(value, key, !isOn);
    if (!isOn) {
      const auto = dependenciesFor(key).filter((dependency) => !enabled.has(dependency));
      if (auto.length > 0) {
        onDependencyApplied?.(
          `${actionLabel(action as never)} requires View — View ${moduleLabel(moduleId)} was enabled automatically.`,
        );
      }
    }
    onChange(next);
  };

  return (
    <div className="space-y-4">
      <p className="flex items-start gap-2 rounded-xl bg-brand-surface-2 px-3 py-2.5 text-xs text-brand-secondary-text ">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand-accent" />
        <span>
          Actions require View access on the same module. Enabling one turns View on automatically;
          turning View off removes the module's other actions.
        </span>
      </p>

      {/* Desktop / laptop matrix */}
      <div className="scroll-rail hidden overflow-x-auto lg:block">
        <table className="w-full min-w-[820px] border-separate border-spacing-0">
          <thead>
            <tr>
              <th
                scope="col"
                className="sticky start-0 bg-white px-3 py-2 text-start text-[11px] font-bold uppercase tracking-wide text-brand-muted "
              >
                Module
              </th>
              {PERMISSION_ACTIONS.map((action) => (
                <th
                  key={action.id}
                  scope="col"
                  className="px-2 py-2 text-center text-[11px] font-bold uppercase tracking-wide text-brand-muted"
                >
                  {action.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERMISSION_MODULES.map((module) => (
              <tr key={module.id} className="border-t border-brand-border-subtle ">
                <th
                  scope="row"
                  className="sticky start-0 border-t border-brand-border-subtle bg-white px-3 py-3 text-start "
                >
                  <span className="block text-sm font-semibold text-brand-navy-deep ">
                    {module.label}
                  </span>
                  <span className="block text-[11px] text-brand-secondary-text ">
                    {module.description}
                  </span>
                </th>
                {PERMISSION_ACTIONS.map((action) => {
                  const supported = module.actions.includes(action.id);
                  const key = permissionKey(module.id, action.id);
                  return (
                    <td
                      key={action.id}
                      className="border-t border-brand-border-subtle px-2 py-3 text-center "
                    >
                      {supported ? (
                        <PermissionToggle
                          checked={enabled.has(key)}
                          disabled={readOnly}
                          label={`${action.label} ${module.label}`}
                          onChange={() => toggle(module.id, action.id)}
                        />
                      ) : (
                        <span className="text-xs text-brand-muted" aria-hidden="true">
                          –
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile / tablet cards */}
      <div className="space-y-3 lg:hidden">
        {PERMISSION_MODULES.map((module) => {
          const granted = module.actions.filter((action) =>
            enabled.has(permissionKey(module.id, action)),
          );
          return (
            <section
              key={module.id}
              className="rounded-2xl border border-brand-border-subtle p-3.5 "
            >
              <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-bold text-brand-navy-deep ">
                    {module.label}
                  </h3>
                  <p className="truncate text-[11px] text-brand-secondary-text ">
                    {module.description}
                  </p>
                </div>
                <StatusPill
                  label={granted.length === 0 ? "No access" : `${granted.length} granted`}
                  tone={granted.length === 0 ? "neutral" : "success"}
                />
              </header>
              <div className="mt-3 flex flex-wrap gap-2">
                {module.actions.map((action) => {
                  const key = permissionKey(module.id, action);
                  const isOn = enabled.has(key);
                  return (
                    <button
                      key={action}
                      type="button"
                      disabled={readOnly}
                      aria-pressed={isOn}
                      onClick={() => toggle(module.id, action)}
                      className={cn(
                        "inline-flex min-h-11 items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan disabled:opacity-60",
                        isOn
                          ? "border-brand-teal/40 bg-brand-teal/12 text-brand-accent"
                          : "border-brand-border bg-white text-brand-secondary-text ",
                      )}
                    >
                      {isOn ? <Check className="h-3.5 w-3.5" /> : null}
                      {actionLabel(action)}
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      {readOnly ? (
        <p className="flex items-center gap-2 text-xs font-semibold text-brand-secondary-text ">
          <Lock className="h-3.5 w-3.5" /> Owner accounts always have full access and cannot be
          edited here.
        </p>
      ) : null}
    </div>
  );
}

/** Accessible switch used by the matrix. */
export function PermissionToggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  disabled?: boolean | undefined;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className={cn(
        "inline-flex h-6 w-11 items-center rounded-full p-0.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-55",
        checked ? "bg-brand-gradient" : "bg-brand-border ",
      )}
    >
      <span
        className={cn(
          "h-5 w-5 rounded-full bg-white shadow-sm transition-transform",
          checked ? "translate-x-5 rtl:-translate-x-5" : "translate-x-0",
        )}
      />
    </button>
  );
}
