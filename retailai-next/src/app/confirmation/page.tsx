"use client";

import { Suspense } from "react";

import { useNavigate, useSearch } from "@/lib/router-compat";import { CalendarClock, Check } from "lucide-react";
import { BottomNav } from "@/components/shop/nav";
import { Card, PrimaryButton, Screen, SecondaryButton } from "@/components/shop/primitives";
import { useOrders } from "@/lib/orders";
import { CHECKOUT, formatPrice, getProduct } from "@/lib/catalog";
import {
  formatScheduleDate,
  getSlotLabel,
  getWindowLabel,
  useScheduledOrders,
} from "@/lib/scheduled-orders";

type ConfirmationSearch = { order?: string; scheduled?: string };



function ConfirmationScreen() {
  const navigate = useNavigate();
  const { order: orderId, scheduled: scheduledId } = useSearch();
  const { getOrder } = useOrders();
  const { getScheduled } = useScheduledOrders();
  const scheduledOrder = getScheduled(scheduledId);
  const order = scheduledId ? undefined : getOrder(orderId);

  if (scheduledId && scheduledOrder) {
    return (
      <>
        <Screen>
          <div className="mx-auto w-full max-w-xl">
            <section className="mt-6 text-center">
              <div className="relative mx-auto grid h-28 w-28 place-items-center">
                <span
                  aria-hidden
                  className="absolute h-28 w-28 rounded-full bg-brand-teal/10 blur-md"
                />
                <span
                  aria-hidden
                  className="absolute h-24 w-24 rounded-full border border-brand-cyan/30"
                />
                <span className="bg-voice-orb grid h-20 w-20 place-items-center rounded-full text-white shadow-[0_20px_40px_-16px_rgba(0,150,145,0.7)]">
                  <CalendarClock className="h-9 w-9" strokeWidth={2.5} />
                </span>
              </div>
              <h1 className="mt-5 text-[22px] font-extrabold leading-tight text-brand-navy-deep lg:text-3xl">
                Order Scheduled
                <br />
                Successfully!
              </h1>
              <p className="mt-2 text-[13px] text-brand-secondary-text">
                We will deliver on {formatScheduleDate(scheduledOrder.date)} at{" "}
                {getSlotLabel(scheduledOrder.timeSlotId)}.
              </p>
            </section>

            <Card className="mt-7">
              <p className="text-center text-[14px] font-extrabold text-brand-accent">
                Order #{scheduledOrder.id}
              </p>
              <div className="mt-3 space-y-2 border-t border-brand-border-subtle pt-3 text-[12px]">
                <SummaryRow
                  label="Delivery date"
                  value={formatScheduleDate(scheduledOrder.date)}
                />
                <SummaryRow label="Delivery time" value={getSlotLabel(scheduledOrder.timeSlotId)} />
                <SummaryRow
                  label="Delivery window"
                  value={getWindowLabel(scheduledOrder.windowId)}
                />
                <SummaryRow label="Address" value={scheduledOrder.address} />
                {scheduledOrder.notes ? (
                  <SummaryRow label="Notes" value={scheduledOrder.notes} />
                ) : null}
              </div>
              <div className="mt-3 space-y-2 border-t border-brand-border-subtle pt-3 text-[12px]">
                {scheduledOrder.items.map((item) => (
                  <div key={item.name} className="flex items-center justify-between gap-3">
                    <span className="min-w-0 truncate text-brand-navy-deep">{item.name}</span>
                    <span className="shrink-0 text-brand-secondary-text">×{item.qty}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-brand-border-subtle pt-3">
                <span className="text-[14px] font-extrabold text-brand-navy-deep">Total</span>
                <span className="text-[15px] font-extrabold text-brand-accent">
                  {formatPrice(scheduledOrder.total)}
                </span>
              </div>
            </Card>

            <div className="mt-6 space-y-2.5">
              <PrimaryButton onClick={() => navigate({ to: "/scheduled-orders" })}>
                View Scheduled Orders
              </PrimaryButton>
              <SecondaryButton onClick={() => navigate({ to: "/home" })}>
                Continue Shopping
              </SecondaryButton>
            </div>
          </div>
        </Screen>
        <BottomNav />
      </>
    );
  }



  if (!order) {
    return (
      <>
        <Screen>
          <Card className="mt-10 text-center">
            <p className="text-sm font-semibold text-brand-navy-deep ">No order to show yet</p>
            <div className="mt-4">
              <PrimaryButton onClick={() => navigate({ to: "/home" })}>Back to Home</PrimaryButton>
            </div>
          </Card>
        </Screen>
        <BottomNav />
      </>
    );
  }

  /** Group the flat product id list back into display lines. */
  const lines = order.productIds.reduce<{ id: string; qty: number }[]>((acc, id) => {
    const existing = acc.find((line) => line.id === id);
    if (existing) existing.qty += 1;
    else acc.push({ id, qty: 1 });
    return acc;
  }, []);

  return (
    <>
      <Screen>
        <section className="mt-6 text-center">
          <div className="relative mx-auto grid h-28 w-28 place-items-center">
            <span
              aria-hidden
              className="absolute h-28 w-28 rounded-full bg-brand-teal/10 blur-md"
            />
            <span
              aria-hidden
              className="absolute h-24 w-24 rounded-full border border-brand-cyan/30"
            />
            <span className="bg-voice-orb grid h-20 w-20 place-items-center rounded-full text-white shadow-[0_20px_40px_-16px_rgba(0,150,145,0.7)]">
              <Check className="h-9 w-9" strokeWidth={3} />
            </span>
          </div>
          <h1 className="mt-5 text-[22px] font-extrabold leading-tight text-brand-navy-deep lg:text-3xl">
            Order Placed
            <br />
            Successfully!
          </h1>
          <p className="mt-2 text-[13px] text-brand-secondary-text ">
            Your order has been confirmed.
          </p>
        </section>

        <Card className="mt-7">
          <p className="text-center text-[14px] font-extrabold text-brand-accent">
            Order #{order.id}
          </p>
          <div className="mt-3 flex items-center justify-between border-b border-brand-border-subtle pb-3 text-[12px] ">
            <span className="text-brand-secondary-text ">Estimated delivery</span>
            <span className="font-bold text-brand-navy-deep ">{CHECKOUT.etaLabel}</span>
          </div>
          <div className="mt-3 space-y-2">
            {lines.map((line) => {
              const product = getProduct(line.id);
              if (!product) return null;
              return (
                <div key={line.id} className="flex items-center gap-3 text-[12px]">
                  <img
                    src={product.image}
                    alt=""
                    aria-hidden
                    width={512}
                    height={512}
                    loading="lazy"
                    className="h-8 w-8 shrink-0 object-contain"
                  />
                  <span className="min-w-0 flex-1 truncate text-brand-navy-deep ">
                    {product.name}
                  </span>
                  <span className="shrink-0 text-brand-secondary-text ">×{line.qty}</span>
                  <span className="w-20 shrink-0 text-end font-bold text-brand-navy-deep ">
                    {formatPrice(product.price * line.qty)}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-brand-border-subtle pt-3 ">
            <span className="text-[14px] font-extrabold text-brand-navy-deep ">Total</span>
            <span className="text-[15px] font-extrabold text-brand-accent">
              {formatPrice(order.total)}
            </span>
          </div>
          {order.instructions ? (
            <p className="mt-3 text-[11px] text-brand-secondary-text ">
              <span className="font-bold text-brand-navy-deep ">Note: </span>
              {order.instructions}
            </p>
          ) : null}
        </Card>

        <div className="mt-6 space-y-2.5">
          <PrimaryButton onClick={() => navigate({ to: "/track", search: { order: order.id } })}>
            Track Order
          </PrimaryButton>
          <SecondaryButton onClick={() => navigate({ to: "/orders" })}>
            View Orders
          </SecondaryButton>
          <SecondaryButton onClick={() => navigate({ to: "/home" })}>
            Continue Shopping
          </SecondaryButton>
        </div>
      </Screen>
      <BottomNav />
    </>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="shrink-0 text-brand-secondary-text">{label}</span>
      <span className="min-w-0 text-end font-bold text-brand-navy-deep">{value}</span>
    </div>
  );
}

export default function ConfirmationScreenPage() {
  return (
    <Suspense fallback={null}>
      <ConfirmationScreen />
    </Suspense>
  );
}

