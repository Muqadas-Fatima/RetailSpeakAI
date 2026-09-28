"use client";

import { Suspense } from "react";

import { useNavigate, useSearch } from "@/lib/router-compat";import { useState } from "react";
import { Check, ChevronDown, MessageSquare, PhoneCall, Star } from "lucide-react";
import { toast } from "sonner";
import { BottomNav } from "@/components/shop/nav";
import { Card, PrimaryButton, Screen, ScreenHeader } from "@/components/shop/primitives";
import { TRACKING, formatPrice, getOrderStatusLabel } from "@/lib/catalog";
import { useOrders } from "@/lib/orders";
import { cn } from "@/lib/utils";

type TrackSearch = { order?: string };



function TrackScreen() {
  const navigate = useNavigate();
  const { order: orderId } = useSearch();
  const { getOrder, getStageIndex } = useOrders();
  const [open, setOpen] = useState(false);

  const order = getOrder(orderId);
  const stages = TRACKING.stages;
  const currentStage = getStageIndex(order);
  const rider = TRACKING.rider;

  if (!order) {
    return (
      <>
        <Screen>
          <ScreenHeader title="Track Your Order" backTo="/orders" />
          <Card className="mt-8 text-center">
            <p className="text-sm font-semibold text-brand-navy-deep ">No order to track yet</p>
            <div className="mt-4">
              <PrimaryButton onClick={() => navigate({ to: "/menu" })}>
                Start an order
              </PrimaryButton>
            </div>
          </Card>
        </Screen>
        <BottomNav />
      </>
    );
  }

  const remainingStages = Math.max(stages.length - 1 - currentStage, 0);
  const etaMinutes = Math.round(
    (TRACKING.etaMinutes * remainingStages) / Math.max(stages.length - 1, 1),
  );

  return (
    <>
      <Screen>
        <ScreenHeader title="Track Your Order" backTo="/orders" />
        <p className="mt-1 text-center text-[12px] font-semibold text-brand-accent">
          #{order.id} · {getOrderStatusLabel(order.status)}
        </p>

        {/* Timeline driven by elapsed time since the order was placed */}
        <Card className="mt-5">
          <ol className="space-y-0">
            {stages.map((stage, index) => {
              const done = index <= currentStage;
              const current = index === currentStage;
              const last = index === stages.length - 1;
              const time =
                done && order.placedAt
                  ? new Date(
                      new Date(order.placedAt).getTime() + stage.afterSeconds * 1000,
                    ).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
                  : "—";
              return (
                <li key={stage.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span
                      className={cn(
                        "grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 transition-colors",
                        done
                          ? "border-brand-teal bg-brand-teal text-white"
                          : "border-brand-border bg-transparent text-transparent ",
                      )}
                    >
                      <Check className="h-3.5 w-3.5" strokeWidth={3} />
                    </span>
                    {!last ? (
                      <span
                        className={cn(
                          "my-1 w-0.5 flex-1 transition-colors",
                          index < currentStage ? "bg-brand-teal" : "bg-brand-border ",
                        )}
                      />
                    ) : null}
                  </div>
                  <div className={cn("min-w-0 flex-1", last ? "pb-0" : "pb-5")}>
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={cn(
                          "truncate text-[13px]",
                          current
                            ? "font-extrabold text-brand-accent"
                            : "font-semibold text-brand-navy-deep ",
                        )}
                      >
                        {stage.label}
                      </span>
                      <span className="shrink-0 text-[11px] text-brand-secondary-text ">
                        {time}
                      </span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </Card>

        {/* ETA */}
        <div className="mt-4 rounded-2xl border border-brand-teal/30 bg-brand-teal/5 px-4 py-3 text-center">
          <p className="text-[13px] font-bold text-brand-accent">
            {remainingStages === 0
              ? "Delivered — enjoy your order!"
              : `Arriving in approximately ${Math.max(etaMinutes, 1)} min`}
          </p>
        </div>

        {/* Map */}
        <Card className="mt-4 overflow-hidden p-0">
          <div className="relative">
            <img
              src={"/assets/map-terrain.jpg"}
              alt="Map showing the route from the store to your delivery address"
              loading="lazy"
              className="h-44 w-full object-cover lg:h-56"
            />
            <span className="absolute left-6 top-6 grid h-7 w-7 place-items-center rounded-full bg-brand-card text-[10px] font-bold text-brand-navy-deep shadow-brand-card ">
              Store
            </span>
            <span className="bg-brand-gradient absolute bottom-6 right-8 grid h-7 w-7 place-items-center rounded-full text-[10px] font-bold text-white shadow-brand-card">
              You
            </span>
            <span
              className="absolute top-1/2 grid h-8 w-8 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-brand-navy-deep text-[9px] font-bold text-white shadow-brand-card transition-all duration-700"
              style={{
                left: `${20 + (60 * currentStage) / Math.max(stages.length - 1, 1)}%`,
              }}
            >
              Rider
            </span>
          </div>
        </Card>

        {/* Rider */}
        <Card className="mt-4 flex items-center gap-3">
          <span className="bg-brand-gradient grid h-11 w-11 shrink-0 place-items-center rounded-full text-sm font-bold text-white">
            {rider.initials}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] text-brand-secondary-text ">Your Rider</p>
            <p className="truncate text-[13px] font-bold text-brand-navy-deep ">{rider.name}</p>
            <p className="flex items-center gap-1 text-[11px] text-brand-secondary-text ">
              <Star className="h-3 w-3 fill-brand-teal text-brand-accent" /> {rider.rating}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <RiderAction label="Call" icon={PhoneCall} />
            <RiderAction label="Message" icon={MessageSquare} />
          </div>
        </Card>

        {/* Expandable order details from the order record */}
        <Card className="mt-4">
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="flex w-full items-center justify-between focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan"
          >
            <span className="text-[13px] font-bold text-brand-navy-deep ">Order Details</span>
            <ChevronDown
              className={cn("h-4 w-4 text-brand-muted transition-transform", open && "rotate-180")}
            />
          </button>
          {open ? (
            <div className="mt-3 space-y-2 border-t border-brand-border-subtle pt-3 text-[12px] ">
              {order.items.map((item) => (
                <DetailRow key={item.name} label={item.name} value={`×${item.qty}`} />
              ))}
              <div className="flex items-center justify-between border-t border-brand-border-subtle pt-2 ">
                <span className="font-extrabold text-brand-navy-deep ">Total</span>
                <span className="font-extrabold text-brand-accent">{formatPrice(order.total)}</span>
              </div>
            </div>
          ) : null}
        </Card>
      </Screen>
      <BottomNav />
    </>
  );
}

function RiderAction({ label, icon: Icon }: { label: string; icon: typeof PhoneCall }) {
  return (
    <button
      type="button"
      onClick={() => toast(`${label} is mocked in this prototype`)}
      className="flex items-center gap-1 rounded-full border border-brand-teal/40 px-3 py-1.5 text-[11px] font-bold text-brand-accent transition-colors hover:bg-brand-teal/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan"
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-brand-navy-deep ">{label}</span>
      <span className="text-brand-secondary-text ">{value}</span>
    </div>
  );
}

export default function TrackScreenPage() {
  return (
    <Suspense fallback={null}>
      <TrackScreen />
    </Suspense>
  );
}

