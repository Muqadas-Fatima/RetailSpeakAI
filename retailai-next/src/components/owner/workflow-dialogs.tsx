"use client";
/**
 * Purchase-order approval / rejection and khata payment dialogs.
 *
 * All three are presentational + local-form-state only: the caller supplies the
 * record and a submit handler, so the same dialogs work for any business type.
 * Errors surfaced by the submit handler are rendered inline with a retry path.
 */
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { FormField } from "@/components/owner/account-widgets";
import { OwnerButton, OwnerModal } from "@/components/owner/confirm-dialog";
import { FilterOptionSelect } from "@/components/owner/select-field";
import { StatusBadge } from "@/components/owner/status-badge";
import { PAYMENT_METHOD_OPTIONS } from "@/lib/owner/records";
import type { KhataDetail, PurchaseOrderRecord } from "@/lib/owner/records";

function SummaryRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-brand-border-subtle py-2 last:border-b-0 ">
      <span className="min-w-0 truncate text-xs font-semibold uppercase tracking-wide text-brand-muted">
        {label}
      </span>
      <span className="shrink-0 text-sm font-bold text-brand-navy-deep ">{value}</span>
    </div>
  );
}

function DialogError({ message }: { message: string }) {
  return (
    <p
      role="alert"
      className="flex items-start gap-2 rounded-xl bg-brand-danger/10 px-3 py-2.5 text-xs font-semibold text-brand-danger"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      {message}
    </p>
  );
}

type SubmitState = { loading: boolean; error: string | null };

function useSubmit(open: boolean) {
  const [state, setState] = useState<SubmitState>({ loading: false, error: null });
  useEffect(() => {
    if (open) setState({ loading: false, error: null });
  }, [open]);

  const run = async (action: () => Promise<unknown>, onDone: () => void) => {
    setState({ loading: true, error: null });
    try {
      await action();
      setState({ loading: false, error: null });
      onDone();
    } catch (cause) {
      setState({
        loading: false,
        error: cause instanceof Error ? cause.message : "Request failed",
      });
    }
  };

  return { ...state, run };
}

/* --------------------------- PO approval dialog --------------------------- */

export function ApprovePurchaseOrderDialog({
  open,
  order,
  onClose,
  onConfirm,
}: {
  open: boolean;
  order: PurchaseOrderRecord | null;
  onClose: () => void;
  /** Should reject to surface a backend error inside the dialog. */
  onConfirm: (input: { id: string; note: string }) => Promise<unknown>;
}) {
  const [note, setNote] = useState("");
  const submit = useSubmit(open);

  useEffect(() => {
    if (open) setNote("");
  }, [open]);

  if (!order) return null;

  return (
    <OwnerModal
      open={open}
      onClose={onClose}
      title="Approve purchase order"
      description={`Confirm approval of ${order.reference}. The supplier will be notified.`}
      size="sm"
      footer={
        <>
          <OwnerButton variant="secondary" onClick={onClose}>
            Cancel
          </OwnerButton>
          <OwnerButton
            loading={submit.loading}
            onClick={() => void submit.run(() => onConfirm({ id: order.id, note }), onClose)}
          >
            <CheckCircle2 className="h-4 w-4" />
            Approve order
          </OwnerButton>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <SummaryRow label="Reference" value={order.reference} />
          <SummaryRow label="Supplier" value={order.supplierName} />
          <SummaryRow label="Items" value={order.itemCount} />
          <SummaryRow label="Total" value={order.total} />
          <SummaryRow label="Status" value={<StatusBadge status={order.status} />} />
        </div>
        <FormField
          id="po-approve-note"
          label="Note (optional)"
          value={note}
          onChange={setNote}
          placeholder="Add an internal note for this approval"
        />
        {submit.error ? <DialogError message={submit.error} /> : null}
      </div>
    </OwnerModal>
  );
}

/* -------------------------- PO rejection dialog -------------------------- */

export function RejectPurchaseOrderDialog({
  open,
  order,
  onClose,
  onConfirm,
}: {
  open: boolean;
  order: PurchaseOrderRecord | null;
  onClose: () => void;
  onConfirm: (input: { id: string; reason: string }) => Promise<unknown>;
}) {
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);
  const submit = useSubmit(open);

  useEffect(() => {
    if (open) {
      setReason("");
      setTouched(false);
    }
  }, [open]);

  if (!order) return null;
  const invalid = reason.trim().length < 3;

  return (
    <OwnerModal
      open={open}
      onClose={onClose}
      title="Reject purchase order"
      description={`${order.reference} will be sent back to the requester.`}
      size="sm"
      footer={
        <>
          <OwnerButton variant="secondary" onClick={onClose}>
            Cancel
          </OwnerButton>
          <OwnerButton
            variant="danger"
            loading={submit.loading}
            onClick={() => {
              setTouched(true);
              if (invalid) return;
              void submit.run(() => onConfirm({ id: order.id, reason: reason.trim() }), onClose);
            }}
          >
            Reject order
          </OwnerButton>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <SummaryRow label="Reference" value={order.reference} />
          <SummaryRow label="Supplier" value={order.supplierName} />
          <SummaryRow label="Total" value={order.total} />
        </div>
        <FormField
          id="po-reject-reason"
          label="Reason for rejection"
          value={reason}
          onChange={setReason}
          placeholder="Explain why this order is rejected"
          error={touched && invalid ? "Please add a short reason (min 3 characters)." : undefined}
        />
        {submit.error ? <DialogError message={submit.error} /> : null}
      </div>
    </OwnerModal>
  );
}

/* ------------------------- Record payment dialog ------------------------- */

export function RecordPaymentDialog({
  open,
  account,
  onClose,
  onConfirm,
}: {
  open: boolean;
  account: Pick<KhataDetail, "id" | "supplierName" | "outstanding"> | null;
  onClose: () => void;
  onConfirm: (input: {
    accountId: string;
    amount: string;
    method: string;
    paidOn: string;
    reference: string;
    note: string;
  }) => Promise<unknown>;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState(PAYMENT_METHOD_OPTIONS[0]?.value ?? "");
  const [paidOn, setPaidOn] = useState(today);
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [touched, setTouched] = useState(false);
  const submit = useSubmit(open);

  useEffect(() => {
    if (!open) return;
    setAmount("");
    setMethod(PAYMENT_METHOD_OPTIONS[0]?.value ?? "");
    setPaidOn(new Date().toISOString().slice(0, 10));
    setReference("");
    setNote("");
    setTouched(false);
  }, [open]);

  if (!account) return null;

  const amountNumber = Number(amount);
  const amountError =
    amount.trim() === ""
      ? "Enter the amount received by the supplier."
      : !Number.isFinite(amountNumber) || amountNumber <= 0
        ? "Amount must be a number greater than zero."
        : undefined;
  const dateError = paidOn ? undefined : "Select the payment date.";
  const invalid = Boolean(amountError || dateError);

  return (
    <OwnerModal
      open={open}
      onClose={onClose}
      title="Record payment"
      description={`Log a payment made to ${account.supplierName}.`}
      footer={
        <>
          <OwnerButton variant="secondary" onClick={onClose}>
            Cancel
          </OwnerButton>
          <OwnerButton
            loading={submit.loading}
            onClick={() => {
              setTouched(true);
              if (invalid) return;
              void submit.run(
                () =>
                  onConfirm({
                    accountId: account.id,
                    amount: amount.trim(),
                    method,
                    paidOn,
                    reference: reference.trim(),
                    note: note.trim(),
                  }),
                onClose,
              );
            }}
          >
            Save payment
          </OwnerButton>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <SummaryRow label="Supplier" value={account.supplierName} />
          <SummaryRow label="Outstanding" value={account.outstanding} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            id="payment-amount"
            label="Amount"
            type="number"
            value={amount}
            onChange={setAmount}
            placeholder="0.00"
            error={touched ? amountError : undefined}
          />
          <FilterOptionSelect
            id="payment-method"
            label="Payment method"
            value={method}
            options={PAYMENT_METHOD_OPTIONS}
            onChange={setMethod}
          />
          <FormField
            id="payment-date"
            label="Paid on"
            type="date"
            value={paidOn}
            onChange={setPaidOn}
            error={touched ? dateError : undefined}
          />
          <FormField
            id="payment-reference"
            label="Reference (optional)"
            value={reference}
            onChange={setReference}
            placeholder="Receipt or transaction no."
          />
        </div>
        <FormField
          id="payment-note"
          label="Note (optional)"
          value={note}
          onChange={setNote}
          placeholder="Anything worth remembering about this payment"
        />
        {submit.error ? <DialogError message={submit.error} /> : null}
      </div>
    </OwnerModal>
  );
}
