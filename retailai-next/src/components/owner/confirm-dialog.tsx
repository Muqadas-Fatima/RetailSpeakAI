"use client";
import { AlertTriangle, Loader2, X } from "lucide-react";
import { type ReactNode, useEffect } from "react";
import { cn } from "@/lib/utils";

/** Shared modal shell used by every owner dialog (form, confirm, detail). */
export function OwnerModal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string | undefined;
  children: ReactNode;
  footer?: ReactNode | undefined;
  size?: "sm" | "md" | "lg";
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
      <div
        role="presentation"
        onClick={onClose}
        className="absolute inset-0 bg-brand-navy-deep/55 backdrop-blur-sm"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "relative z-10 flex max-h-[92svh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl",
          size === "sm" && "sm:max-w-md",
          size === "md" && "sm:max-w-xl",
          size === "lg" && "sm:max-w-4xl",
        )}
      >
        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 border-b border-brand-border-subtle px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-brand-navy-deep sm:text-lg">{title}</h2>
            {description ? (
              <p className="mt-0.5 text-xs text-brand-secondary-text sm:text-sm">{description}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="shrink-0 rounded-lg p-1.5 text-brand-secondary-text transition-colors hover:bg-brand-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan "
          >
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="scroll-touch min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">{children}</div>
        {footer ? (
          <footer className="flex flex-col-reverse gap-2 border-t border-brand-border-subtle px-4 py-3.5 sm:flex-row sm:justify-end sm:px-6">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>
  );
}

export function OwnerButton({
  children,
  onClick,
  type = "button",
  variant = "primary",
  disabled,
  loading,
  className,
}: {
  children: ReactNode;
  onClick?: (() => void) | undefined;
  type?: "button" | "submit";
  variant?: "primary" | "secondary" | "danger" | "ghost";
  disabled?: boolean | undefined;
  loading?: boolean | undefined;
  className?: string | undefined;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-55",
        variant === "primary" && "bg-brand-gradient text-white",
        variant === "secondary" &&
          "border border-brand-border bg-white text-brand-navy-deep hover:bg-brand-surface-2 ",
        variant === "danger" && "bg-destructive text-white hover:bg-destructive/90",
        variant === "ghost" && "text-brand-secondary-text hover:bg-brand-surface-2 ",
        className,
      )}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      {children}
    </button>
  );
}

/** Confirmation dialog with Cancel / confirm actions. */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel = "Cancel",
  tone = "primary",
  loading,
  onCancel,
  onConfirm,
  children,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string | undefined;
  tone?: "primary" | "danger";
  loading?: boolean | undefined;
  onCancel: () => void;
  onConfirm: () => void;
  children?: ReactNode | undefined;
}) {
  return (
    <OwnerModal
      open={open}
      onClose={onCancel}
      title={title}
      size="sm"
      footer={
        <>
          <OwnerButton variant="secondary" onClick={onCancel}>
            {cancelLabel}
          </OwnerButton>
          <OwnerButton
            variant={tone === "danger" ? "danger" : "primary"}
            onClick={onConfirm}
            loading={loading}
          >
            {confirmLabel}
          </OwnerButton>
        </>
      }
    >
      <div className="flex gap-3">
        <span
          className={cn(
            "grid h-9 w-9 shrink-0 place-items-center rounded-full",
            tone === "danger"
              ? "bg-destructive/10 text-brand-danger"
              : "bg-brand-cyan/12 text-brand-accent",
          )}
        >
          <AlertTriangle className="h-4.5 w-4.5" />
        </span>
        <div className="min-w-0 space-y-3 text-sm text-brand-secondary-text ">
          <p>{message}</p>
          {children}
        </div>
      </div>
    </OwnerModal>
  );
}
