"use client";

import { useNavigate } from "@/lib/router-compat";import { useState } from "react";
import { CalendarClock, Clock, Hourglass, MapPin, NotebookPen } from "lucide-react";
import { toast } from "sonner";
import { BottomNav } from "@/components/shop/nav";
import { Card, PrimaryButton, Screen, ScreenHeader } from "@/components/shop/primitives";
import { useCart } from "@/lib/cart";
import { useCustomerProfile } from "@/lib/customer-profile";
import { formatPrice, getProduct } from "@/lib/catalog";
import {
  PRE_ORDER,
  maxDateInput,
  todayInput,
  useScheduledOrders,
  type PreOrderSlot,
} from "@/lib/scheduled-orders";
import { cn } from "@/lib/utils";



function PreOrderDetailsScreen() {
  const navigate = useNavigate();
  const { lines, total } = useCart();
  const { profile } = useCustomerProfile();
  const { draft, setDraft, getScheduled } = useScheduledOrders();
  const editing = getScheduled(draft?.editingId);

  const [date, setDate] = useState(draft?.date ?? todayInput());
  const [timeSlotId, setTimeSlotId] = useState(draft?.timeSlotId ?? "");
  const [windowId, setWindowId] = useState(draft?.windowId ?? PRE_ORDER.windows[0]?.id ?? "");
  const [notes, setNotes] = useState(draft?.notes ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const min = todayInput();
  const max = maxDateInput();
  const itemCount = editing
    ? editing.items.reduce((sum, item) => sum + item.qty, 0)
    : lines.reduce((sum, line) => sum + line.qty, 0);
  const amount = editing ? editing.total : total;

  const submit = () => {
    const next: Record<string, string> = {};
    if (!date) next["date"] = "Choose a delivery date.";
    else if (date < min) next["date"] = "Past dates cannot be scheduled.";
    else if (date > max) next["date"] = `Schedule up to ${PRE_ORDER.maxDaysAhead} days ahead.`;
    if (!timeSlotId) next["time"] = "Choose a delivery time.";
    if (!windowId) next["window"] = "Choose an estimated delivery window.";
    if (!editing && lines.length === 0) next["cart"] = "Your cart is empty.";
    setErrors(next);
    if (Object.keys(next).length > 0) {
      toast.error("Please complete the schedule details.");
      return;
    }
    setDraft({
      date,
      timeSlotId,
      windowId,
      notes: notes.trim(),
      ...(draft?.editingId ? { editingId: draft.editingId } : {}),
    });
    navigate({ to: "/pre-order-review" });
  };

  return (
    <>
      <Screen className="pb-36">
        <ScreenHeader title={editing ? "Edit Schedule" : "Schedule Order"} backTo="/checkout" />

        <div className="mx-auto w-full max-w-2xl lg:max-w-5xl">
          <p className="mt-4 text-[13px] leading-relaxed text-brand-secondary-text sm:text-sm">
            Choose when you would like this order delivered. You can edit or cancel a scheduled
            order any time before the delivery window.
          </p>

          <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:items-start lg:gap-6">
            <div className="space-y-4">
              <Card>
                <FieldLabel icon={<CalendarClock className="h-4 w-4" />} text="Delivery date" />
                <input
                  type="date"
                  value={date}
                  min={min}
                  max={max}
                  onChange={(event) => setDate(event.target.value)}
                  className="mt-2.5 h-13 w-full rounded-2xl border border-brand-border-subtle bg-brand-surface px-4 text-sm font-semibold text-brand-navy-deep focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan"
                />
                <FieldError message={errors["date"]} />
              </Card>

              <Card>
                <FieldLabel icon={<Clock className="h-4 w-4" />} text="Delivery time" />
                <ChipGroup
                  options={PRE_ORDER.timeSlots}
                  activeId={timeSlotId}
                  onChange={setTimeSlotId}
                  ariaLabel="Delivery time"
                />
                <FieldError message={errors["time"]} />
              </Card>

              <Card>
                <FieldLabel
                  icon={<Hourglass className="h-4 w-4" />}
                  text="Estimated delivery window"
                />
                <ChipGroup
                  options={PRE_ORDER.windows}
                  activeId={windowId}
                  onChange={setWindowId}
                  ariaLabel="Estimated delivery window"
                  columns
                />
                <FieldError message={errors["window"]} />
              </Card>

              <Card>
                <FieldLabel
                  icon={<NotebookPen className="h-4 w-4" />}
                  text="Delivery notes (optional)"
                />
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={3}
                  placeholder={PRE_ORDER.notesPlaceholder}
                  className="mt-2.5 w-full resize-none rounded-2xl border border-brand-border-subtle bg-brand-surface px-4 py-3 text-[13px] text-brand-navy-deep placeholder:text-brand-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan"
                />
              </Card>
            </div>

            <Card className="lg:sticky lg:top-8">
              <h2 className="text-[14px] font-bold text-brand-navy-deep">Order to schedule</h2>
              <div className="mt-3 flex items-start gap-3">
                <span className="bg-brand-gradient grid h-9 w-9 shrink-0 place-items-center rounded-full text-white">
                  <MapPin className="h-4.5 w-4.5" />
                </span>
                <p className="min-w-0 text-[12px] leading-relaxed text-brand-secondary-text">
                  {editing ? editing.address : profile.address}
                </p>
              </div>
              <div className="mt-3 space-y-2 border-t border-brand-border-subtle pt-3 text-[12px]">
                {(editing
                  ? editing.items
                  : lines.map((line) => ({
                      name: getProduct(line.id)?.name ?? line.id,
                      qty: line.qty,
                    }))
                ).map((item) => (
                  <div key={item.name} className="flex items-center justify-between gap-3">
                    <span className="min-w-0 truncate text-brand-navy-deep">{item.name}</span>
                    <span className="shrink-0 text-brand-secondary-text">×{item.qty}</span>
                  </div>
                ))}
                {itemCount === 0 ? (
                  <p className="text-brand-secondary-text">No items yet — add products first.</p>
                ) : null}
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-brand-border-subtle pt-3">
                <span className="text-[13px] font-extrabold text-brand-navy-deep">Total</span>
                <span className="text-[14px] font-extrabold text-brand-accent">
                  {formatPrice(amount)}
                </span>
              </div>
              <FieldError message={errors["cart"]} />
            </Card>
          </div>

          <div className="mt-6 lg:mt-8 lg:max-w-sm">
            <PrimaryButton onClick={submit}>Continue</PrimaryButton>
          </div>
        </div>
      </Screen>
      <BottomNav />
    </>
  );
}

function FieldLabel({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-2 text-[13px] font-bold text-brand-navy-deep">
      <span className="text-brand-accent">{icon}</span>
      {text}
    </div>
  );
}

function FieldError({ message }: { message?: string | undefined }) {
  if (!message) return null;
  return <p className="mt-2 text-[11px] font-semibold text-red-500">{message}</p>;
}

function ChipGroup({
  options,
  activeId,
  onChange,
  ariaLabel,
  columns,
}: {
  options: PreOrderSlot[];
  activeId: string;
  onChange: (id: string) => void;
  ariaLabel: string;
  columns?: boolean;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        "mt-2.5 grid gap-2",
        columns ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4",
      )}
    >
      {options.map((option) => {
        const active = option.id === activeId;
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.id)}
            className={cn(
              "flex min-h-11 items-center justify-center rounded-2xl border px-3 py-2.5 text-center text-[12px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan",
              active
                ? "border-brand-teal bg-brand-teal/10 text-brand-accent"
                : "border-brand-border-subtle bg-white text-brand-navy-deep hover:border-brand-teal/40",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export default PreOrderDetailsScreen;
