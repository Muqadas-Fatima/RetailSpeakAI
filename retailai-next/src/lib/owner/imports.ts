"use client";
/**
 * CSV import configuration + submit driver.
 * Column templates are schema configuration (not business data); the actual
 * parsing/ingestion happens on the backend once `submitImport` is wired.
 */
import { useCallback, useRef, useState } from "react";
import { IMPORT_ENTITY_OPTIONS, submitImport } from "./records";
import type { StagedFile } from "@/components/owner/csv-upload";

/** Expected CSV headers per import target. */
export const IMPORT_TEMPLATES: Record<string, string[]> = {
  products: ["name", "sku", "category", "price", "unit", "status"],
  inventory: ["sku", "on_hand", "unit", "reorder_level", "location"],
  suppliers: ["name", "contact_name", "phone", "category", "payment_terms"],
  "purchase-orders": ["reference", "supplier", "sku", "quantity", "unit_cost", "expected_at"],
};

export function importEntityLabel(entity: string): string {
  return IMPORT_ENTITY_OPTIONS.find((option) => option.value === entity)?.label ?? entity;
}

export type ImportPhase = "idle" | "uploading" | "success" | "error";

export function useCsvImport(initialEntity: string) {
  const [entity, setEntity] = useState(initialEntity);
  const [file, setFile] = useState<StagedFile | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [phase, setPhase] = useState<ImportPhase>("idle");
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopTimer = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  };

  const reset = useCallback(() => {
    stopTimer();
    setFile(null);
    setFileError(null);
    setPhase("idle");
    setProgress(0);
    setMessage(null);
  }, []);

  const start = useCallback(async () => {
    if (!file || fileError) return;
    setPhase("uploading");
    setProgress(4);
    setMessage(null);

    stopTimer();
    timer.current = setInterval(() => {
      setProgress((current) => (current >= 92 ? current : current + 8));
    }, 120);

    try {
      // Row count is estimated from the staged file so the demo history looks real.
      const rowCount = Math.max(1, Math.round(file.size / 120));
      await submitImport({ entity, fileName: file.name, fileSize: file.size, rowCount });
      stopTimer();
      setProgress(100);
      setPhase("success");
      setMessage("Import queued. It now appears in your import history below.");
    } catch (cause) {
      stopTimer();
      setProgress(0);
      setPhase("error");
      setMessage(cause instanceof Error ? cause.message : "Import failed");
    }
  }, [entity, file, fileError]);

  return {
    entity,
    setEntity,
    file,
    setFile,
    fileError,
    setFileError,
    phase,
    progress,
    message,
    start,
    reset,
    templateColumns: IMPORT_TEMPLATES[entity] ?? [],
  };
}
