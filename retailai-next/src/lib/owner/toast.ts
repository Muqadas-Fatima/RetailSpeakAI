"use client";
/**
 * Single toast entry point for the Owner Portal.
 * Wraps sonner so every screen emits consistent success / error / warning / info
 * feedback. Messages are passed in by callers — no business copy is baked in.
 */
import { toast } from "sonner";

type ToastOptions = { description?: string | undefined };

export const ownerToast = {
  success: (message: string, options?: ToastOptions) =>
    toast.success(message, { description: options?.description }),
  error: (message: string, options?: ToastOptions) =>
    toast.error(message, { description: options?.description }),
  warning: (message: string, options?: ToastOptions) =>
    toast.warning(message, { description: options?.description }),
  info: (message: string, options?: ToastOptions) =>
    toast.info(message, { description: options?.description }),
};

/**
 * Frontend-only confirmations for common owner actions. Each accepts the label
 * of the affected record so no entity names are hardcoded.
 */
export const ownerToastMessages = {
  purchaseOrderApproved: (reference: string) => `Purchase order ${reference} approved`,
  purchaseOrderRejected: (reference: string) => `Purchase order ${reference} rejected`,
  productUpdated: (name: string) => `${name} updated`,
  productDeleted: (name: string) => `${name} deleted`,
  supplierAdded: (name: string) => `${name} added`,
  permissionsUpdated: (name: string) => `Permissions updated for ${name}`,
  paymentRecorded: (name: string) => `Payment recorded for ${name}`,
  settingsSaved: (section: string) => `${section} saved`,
};
