"use client";

import { useNavigate } from "@/lib/router-compat";import { CalendarClock, Clock, Hourglass, MapPin, NotebookPen, Pencil } from "lucide-react";
import { toast } from "sonner";
import { BottomNav } from "@/components/shop/nav";
import {
  Card,
  PrimaryButton,
  Screen,
  ScreenHeader,
  SecondaryButton,
} from "@/components/shop/primitives";
import { useCart } from "@/lib/cart";
import { useCustomerProfile } from "@/lib/customer-profile";
import { formatPrice, getProduct } from "@/lib/catalog";
import {
  formatScheduleDate,
  getSlotLabel,
  getWindowLabel,
  useScheduledOrders,
} from "@/lib/scheduled-orders";



function PreOrderReviewScreen() {
  const navigate = useNavigate();
  const { lines, total, clear } = useCart();
  const { profile } = useCustomerProfile();
  const { draft, setDraft, schedule, updateSchedule, getScheduled } = useScheduledOrders();
  const editing = getScheduled(draft?.editingId);

  if (!draft) {
    return (
      <>
        <Screen>
          <ScreenHeader title="Review Schedule" backTo="/pre-order" />
          <Card className="mx-auto mt-10 max-w-md text-center">
            <p className="text-sm font-semibold text-brand-navy-deep">
              No schedule details to review yet.
            </p>
            <div className="mt-4">
              <PrimaryButton onClick={() => navigate({ to: "/pre-order" })}>
                Schedule an Order
              </PrimaryButton>
            </div>
          </Card>
        </Screen>
        <BottomNav />
      </>
    );
  }

  const items = editing
    ? editing.items
    : lines.map((line) => ({ name: getProduct(line.id)?.name ?? line.id, qty: line.qty }));
  const productIds = editing
    ? editing.productIds
    : lines.flatMap((line) => Array.from({ length: line.qty }, () => line.id));
  const amount = editing ? editing.total : total;
  const address = editing ? editing.address : profile.address;

  const confirm = () => {
    if (items.length === 0) {
      toast.error("Add items before confirming a schedule.");
      return;
    }
    if (editing) {
      updateSchedule(editing.id, {
        date: draft.date,
        timeSlotId: draft.timeSlotId,
        windowId: draft.windowId,
        notes: draft.notes,
        status: "upcoming",
      });
      setDraft(null);
      toast.success(`Schedule for ${editing.id} updated`);
      navigate({ to: "/confirmation", search: { scheduled: editing.id } });
      return;
    }
    const order = schedule({
      date: draft.date,
      timeSlotId: draft.timeSlotId,
      windowId: draft.windowId,
      address,
      items,
      productIds,
      total: amount,
      ...(draft.notes ? { notes: draft.notes } : {}),
    });
    setDraft(null);
    clear();
    toast.success(`Order ${order.id} scheduled`);
    navigate({ to: "/confirmation", search: { scheduled: order.id } });
  };

  return (
    <>
      <Screen className="pb-36">
        <ScreenHeader title="Review Schedule" backTo="/pre-order" />

        <div className="mx-auto w-full max-w-2xl lg:max-w-5xl">
          <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start lg:gap-6">
            <div className="space-y-4">
              <Card>
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-[14px] font-bold text-brand-navy-deep">Delivery schedule</h2>
                  <button
                    type="button"
                    aria-label="Edit schedule details"
                    onClick={() => navigate({ to: "/pre-order" })}
                    className="rounded-lg p-1 text-brand-muted transition-colors hover:text-brand-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-3 space-y-3">
                  <ReviewRow
                    icon={<CalendarClock className="h-4 w-4" />}
                    label="Date"
                    value={formatScheduleDate(draft.date)}
                  />
                  <ReviewRow
                    icon={<Clock className="h-4 w-4" />}
                    label="Time"
                    value={getSlotLabel(draft.timeSlotId)}
                  />
                  <ReviewRow
                    icon={<Hourglass className="h-4 w-4" />}
                    label="Delivery window"
                    value={getWindowLabel(draft.windowId)}
                  />
                  {draft.notes ? (
                    <ReviewRow
                      icon={<NotebookPen className="h-4 w-4" />}
                      label="Notes"
                      value={draft.notes}
                    />
                  ) : null}
                </div>
              </Card>

              <Card>
                <h2 className="text-[14px] font-bold text-brand-navy-deep">Delivery address</h2>
                <div className="mt-3 flex items-start gap-3">
                  <span className="bg-brand-gradient grid h-9 w-9 shrink-0 place-items-center rounded-full text-white">
                    <MapPin className="h-4.5 w-4.5" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[13px] font-bold text-brand-navy-deep">
                      {profile.fullName}
                    </p>
                    <p className="text-[12px] leading-relaxed text-brand-secondary-text">
                      {address}
                    </p>
                  </div>
                </div>
              </Card>
            </div>

            <Card className="lg:sticky lg:top-8">
              <h2 className="text-[14px] font-bold text-brand-navy-deep">Order summary</h2>
              <div className="mt-3 space-y-2.5 text-[12px]">
                {items.map((item) => (
                  <div key={item.name} className="flex items-center justify-between gap-3">
                    <span className="min-w-0 truncate text-brand-navy-deep">{item.name}</span>
                    <span className="shrink-0 font-semibold text-brand-secondary-text">
                      ×{item.qty}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-brand-border-subtle pt-3">
                <span className="text-[14px] font-extrabold text-brand-navy-deep">Total</span>
                <span className="text-[15px] font-extrabold text-brand-accent">
                  {formatPrice(amount)}
                </span>
              </div>
            </Card>
          </div>

          <div className="mt-6 flex flex-col gap-2.5 sm:flex-row-reverse sm:items-center lg:mt-8">
            <PrimaryButton onClick={confirm} className="sm:w-64">
              Confirm Schedule
            </PrimaryButton>
            <SecondaryButton onClick={() => navigate({ to: "/pre-order" })} className="sm:w-48">
              Back
            </SecondaryButton>
          </div>
        </div>
      </Screen>
      <BottomNav />
    </>
  );
}

function ReviewRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 shrink-0 text-brand-accent">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-secondary-text">
          {label}
        </p>
        <p className="text-[13px] font-bold leading-relaxed text-brand-navy-deep">{value}</p>
      </div>
    </div>
  );
}

export default PreOrderReviewScreen;
