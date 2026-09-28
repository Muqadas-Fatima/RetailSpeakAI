"use client";
/**
 * CSV import UI: dropzone, staged-file card, progress, success/error states and
 * the template hint list. Files are validated locally (type + size) and never
 * parsed or uploaded here — submission is delegated to the caller's handler.
 */
import {
  AlertTriangle,
  CheckCircle2,
  CloudUpload,
  Download,
  FileSpreadsheet,
  RotateCcw,
  X,
} from "lucide-react";
import { useRef, useState } from "react";
import { OwnerButton } from "@/components/owner/confirm-dialog";
import { cn } from "@/lib/utils";

export type StagedFile = { name: string; size: number };

const MAX_SIZE = 5 * 1024 * 1024;

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Local-only validation so the user gets instant feedback. */
export function validateCsvFile(file: StagedFile): string | null {
  if (!file.name.toLowerCase().endsWith(".csv")) return "Only .csv files are supported.";
  if (file.size === 0) return "This file is empty.";
  if (file.size > MAX_SIZE) return `Files must be under ${formatFileSize(MAX_SIZE)}.`;
  return null;
}

export function FileDropzone({
  onSelect,
  disabled,
}: {
  onSelect: (file: StagedFile) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);

  const handleFiles = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    onSelect({ name: file.name, size: file.size });
  };

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        if (!disabled) handleFiles(event.dataTransfer.files);
      }}
      className={cn(
        "rounded-2xl border-2 border-dashed p-6 text-center transition-colors sm:p-8",
        dragging
          ? "border-brand-accent bg-brand-accent/5"
          : "border-brand-border bg-brand-surface-2 ",
      )}
    >
      <CloudUpload
        aria-hidden="true"
        className="mx-auto h-9 w-9 text-brand-accent sm:h-10 sm:w-10"
      />
      <p className="mt-3 text-sm font-bold text-brand-navy-deep ">Drag a CSV file here</p>
      <p className="mt-1 text-xs text-brand-secondary-text ">
        Maximum {formatFileSize(MAX_SIZE)} · one file at a time
      </p>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="sr-only"
        onChange={(event) => {
          handleFiles(event.target.files);
          event.target.value = "";
        }}
      />
      <OwnerButton
        variant="secondary"
        className="mt-4"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
      >
        Browse files
      </OwnerButton>
    </div>
  );
}

export function StagedFileCard({
  file,
  error,
  onRemove,
}: {
  file: StagedFile;
  error?: string | null;
  onRemove: () => void;
}) {
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-brand-border-subtle bg-white p-3.5 ">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-accent/10 text-brand-accent">
        <FileSpreadsheet className="h-5 w-5" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-bold text-brand-navy-deep ">{file.name}</span>
        <span className="block truncate text-xs text-brand-secondary-text ">
          {formatFileSize(file.size)}
        </span>
        {error ? (
          <span className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-brand-danger">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {error}
          </span>
        ) : null}
      </span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${file.name}`}
        className="shrink-0 rounded-lg p-1.5 text-brand-secondary-text transition-colors hover:bg-brand-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan "
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export function UploadProgress({ value, label }: { value: number; label: string }) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div role="status" className="space-y-1.5">
      <div className="flex items-center justify-between text-xs font-semibold">
        <span className="text-brand-navy-deep ">{label}</span>
        <span className="text-brand-muted">{clamped}%</span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-2 overflow-hidden rounded-full bg-brand-surface-2 "
      >
        <div
          className="bg-brand-gradient h-full rounded-full transition-[width] duration-200"
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}

export function ImportResult({
  tone,
  title,
  message,
  onRetry,
  onDismiss,
}: {
  tone: "success" | "error";
  title: string;
  message: string;
  onRetry?: (() => void) | undefined;
  onDismiss?: (() => void) | undefined;
}) {
  const success = tone === "success";
  return (
    <div
      role={success ? "status" : "alert"}
      className={cn(
        "flex flex-col gap-3 rounded-2xl border p-3.5 sm:flex-row sm:items-center",
        success
          ? "border-brand-accent/30 bg-brand-accent/10"
          : "border-brand-danger/30 bg-brand-danger/10",
      )}
    >
      <span className="flex min-w-0 flex-1 items-start gap-2.5">
        {success ? (
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-brand-accent" aria-hidden="true" />
        ) : (
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-brand-danger" aria-hidden="true" />
        )}
        <span className="min-w-0">
          <span className="block text-sm font-bold text-brand-navy-deep ">{title}</span>
          <span className="block text-xs text-brand-secondary-text ">{message}</span>
        </span>
      </span>
      <span className="flex shrink-0 gap-2">
        {onRetry ? (
          <OwnerButton variant="secondary" onClick={onRetry}>
            <RotateCcw className="h-4 w-4" />
            Retry
          </OwnerButton>
        ) : null}
        {onDismiss ? (
          <OwnerButton variant="ghost" onClick={onDismiss}>
            Dismiss
          </OwnerButton>
        ) : null}
      </span>
    </div>
  );
}

/** Column expectations per import target, supplied by the caller as config. */
export function TemplateHint({ columns, entityLabel }: { columns: string[]; entityLabel: string }) {
  return (
    <div className="rounded-2xl border border-brand-border-subtle p-3.5 ">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <p className="min-w-0 text-sm font-bold text-brand-navy-deep ">
          {entityLabel} template columns
        </p>
        <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold text-brand-muted">
          <Download className="h-3.5 w-3.5" aria-hidden="true" />
          CSV
        </span>
      </div>
      <ul className="mt-2.5 flex flex-wrap gap-1.5">
        {columns.map((column) => (
          <li
            key={column}
            className="rounded-lg bg-brand-surface-2 px-2 py-1 font-mono text-[11px] font-semibold text-brand-navy-deep "
          >
            {column}
          </li>
        ))}
      </ul>
    </div>
  );
}
