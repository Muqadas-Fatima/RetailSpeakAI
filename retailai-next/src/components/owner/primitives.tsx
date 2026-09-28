"use client";
import { Link } from "@/lib/router-compat";
import { AlertTriangle, Inbox, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Enterprise panel: shared surface for every owner card / table container. */
export function Panel({
  children,
  className,
  as: Tag = "section",
}: {
  children: ReactNode;
  className?: string;
  as?: "section" | "div" | "article";
}) {
  return (
    <Tag
      className={cn(
        "rounded-2xl border border-brand-border-subtle bg-white shadow-[0_10px_24px_-18px_rgba(7,27,51,0.28)] ",
        className,
      )}
    >
      {children}
    </Tag>
  );
}

export function PanelHeader({
  title,
  description,
  actionLabel,
  actionTo,
  children,
}: {
  title: string;
  description?: string | undefined;
  actionLabel?: string | undefined;
  actionTo?: string | undefined;
  children?: ReactNode;
}) {
  return (
    <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-brand-border-subtle px-4 py-3.5 sm:px-5">
      <div className="min-w-0">
        <h2 className="truncate text-sm font-bold text-brand-navy-deep sm:text-base">{title}</h2>
        {description ? (
          <p className="mt-0.5 truncate text-xs text-brand-secondary-text ">{description}</p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {children}
        {actionLabel && actionTo ? (
          <Link
            to={actionTo}
            className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-brand-accent transition-colors hover:bg-brand-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan "
          >
            {actionLabel}
          </Link>
        ) : null}
      </div>
    </header>
  );
}

export function PanelBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("p-4 sm:p-5", className)}>{children}</div>;
}

/** Skeleton block used by every loading state so shimmer stays consistent. */
export function SkeletonBlock({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties | undefined;
}) {
  return (
    <div
      className={cn("animate-pulse rounded-lg bg-brand-surface-2 ", className)}
      style={style}
      aria-hidden="true"
    />
  );
}

export function SkeletonRows({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2.5" role="status" aria-label="Loading">
      {Array.from({ length: rows }).map((_, index) => (
        <SkeletonBlock key={index} className="h-10 w-full" />
      ))}
    </div>
  );
}

export function EmptyState({
  title,
  description,
}: {
  title: string;
  description?: string | undefined;
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
      <span className="grid h-10 w-10 place-items-center rounded-full bg-brand-surface-2 text-brand-secondary-text ">
        <Inbox className="h-5 w-5" />
      </span>
      <p className="text-sm font-semibold text-brand-navy-deep ">{title}</p>
      {description ? (
        <p className="max-w-xs text-xs text-brand-secondary-text ">{description}</p>
      ) : null}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-8 text-center">
      <span className="grid h-10 w-10 place-items-center rounded-full bg-destructive/10 text-brand-danger">
        <AlertTriangle className="h-5 w-5" />
      </span>
      <p className="text-sm font-semibold text-brand-navy-deep ">Couldn't load this data</p>
      <p className="max-w-xs text-xs text-brand-secondary-text ">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-1.5 rounded-lg border border-brand-border bg-white px-3 py-1.5 text-xs font-semibold text-brand-navy-deep transition-colors hover:bg-brand-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan "
      >
        <RefreshCw className="h-3.5 w-3.5" />
        Retry
      </button>
    </div>
  );
}

/**
 * Renders exactly one of loading / error / empty / content for any resource,
 * so no screen re-implements state handling.
 */
export function ResourceState({
  isLoading,
  error,
  isEmpty,
  onRetry,
  emptyTitle,
  emptyDescription,
  skeleton,
  children,
}: {
  isLoading: boolean;
  error: string | null;
  isEmpty: boolean;
  onRetry: () => void;
  emptyTitle: string;
  emptyDescription?: string | undefined;
  skeleton?: ReactNode;
  children: ReactNode;
}) {
  if (isLoading) return <>{skeleton ?? <SkeletonRows />}</>;
  if (error) return <ErrorState message={error} onRetry={onRetry} />;
  if (isEmpty) return <EmptyState title={emptyTitle} description={emptyDescription} />;
  return <>{children}</>;
}

type Tone = "neutral" | "info" | "success" | "warning" | "critical";

const TONE_CLASSES: Record<Tone, string> = {
  neutral: "bg-brand-surface-2 text-brand-secondary-text ",
  info: "bg-brand-cyan/12 text-brand-info ",
  success: "bg-brand-teal/12 text-brand-accent ",
  warning: "bg-amber-500/12 text-brand-warning ",
  critical: "bg-destructive/10 text-brand-danger ",
};

export function StatusPill({
  label,
  tone = "neutral",
  className,
}: {
  label: string;
  tone?: Tone | undefined;
  className?: string | undefined;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize",
        TONE_CLASSES[tone],
        className,
      )}
    >
      {label}
    </span>
  );
}

/** Horizontally scrollable table wrapper — tables never break small screens. */
export function TableScroll({ children }: { children: ReactNode }) {
  return (
    <div className="scroll-rail -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <div className="min-w-[560px]">{children}</div>
    </div>
  );
}

export function Th({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <th
      scope="col"
      className={cn(
        "whitespace-nowrap px-3 py-2 text-start text-[11px] font-bold uppercase tracking-wide text-brand-muted",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({ children, className }: { children: ReactNode; className?: string }) {
  return <td className={cn("px-3 py-3 text-sm text-brand-navy-deep ", className)}>{children}</td>;
}

export function Tr({ children }: { children: ReactNode }) {
  return <tr className="border-t border-brand-border-subtle ">{children}</tr>;
}

/** Initials fallback for owner/user avatars. */
export function initialsOf(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "O"
  );
}

export function Avatar({
  name,
  src,
  className,
}: {
  name: string;
  src?: string | undefined;
  className?: string | undefined;
}) {
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={cn("h-9 w-9 shrink-0 rounded-full object-cover", className)}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={cn(
        "bg-brand-gradient grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-bold text-white",
        className,
      )}
    >
      {initialsOf(name)}
    </span>
  );
}
