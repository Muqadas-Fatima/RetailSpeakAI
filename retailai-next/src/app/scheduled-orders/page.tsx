"use client";

import { useNavigate } from "@/lib/router-compat";import { useState } from "react";
import { CalendarClock, Clock, Hourglass, MapPin, NotebookPen } from "lucide-react";
import { toast } from "sonner";
import { BottomNav } from "@/components/shop/nav";
import { FilterTabs } from "@/components/shop/collections";
import {
  Card,
  PrimaryButton,
  Screen,
  ScreenHeader,
  SecondaryButton,
} from "@/components/shop/primitives";
import { useCart } from "@/lib/cart";
import { formatPrice } from "@/lib/catalog";
import {
  PRE_ORDER_TABS,
  formatScheduleDate,
  getScheduleStatusLabel,
  getSlotLabel,
  getWindowLabel,
  useScheduledOrders,
  type ScheduledOrder,
} from "@/lib/scheduled-orders";
import { cn } from "@/lib/utils";



function ScheduledOrdersScreen() {
  const navigate = useNavigate();
  const { replaceWith } = useCart();
  const { scheduled, setDraft, cancelSchedule } = useScheduledOrders();
  const [tabId, setTabId] = useState<string>(PRE_ORDER_TABS[0]?.id ?? "upcoming");
  const [openId, setOpenId] = useState<string | null>(null);

  const activeTab = PRE_ORDER_TABS.find((tab) => tab.id === tabId);
  const orders = scheduled.filter((order) => order.status === activeTab?.status);

  const editSchedule = (order: ScheduledOrder) => {
    setDraft({
      date: order.date,
      timeSlotId: order.timeSlotId,
      windowId: order.windowId,
      notes: order.notes ?? "",
      editingId: order.id,
    });
    navigate({ to: "/pre-order" });
  };

  return (
    <>
      <Screen>
        <ScreenHeader title="Scheduled Orders" backTo="/home" />

        <div className="mx-auto w-full max-w-2xl lg:max-w-6xl">
          <FilterTabs tabs={PRE_ORDER_TABS} activeId={tabId} onChange={(tab) => setTabId(tab.id)} />

          {orders.length === 0 ? (
            <Card className="mt-5 text-center">
              <p className="text-[13px] font-semibold text-brand-navy-deep">
                No {activeTab?.label.toLowerCase()} scheduled orders yet.
              </p>
              <div className="mx-auto mt-4 max-w-xs">
                <PrimaryButton onClick={() => navigate({ to: "/menu" })}>
                  Start an Order
                </PrimaryButton>
              </div>
            </Card>
          ) : (
            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {orders.map((order) => {
                const open = openId === order.id;
                return (
                  <Card key={order.id} className="flex flex-col">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-extrabold text-brand-navy-deep">
                          #{order.id}
                        </p>
                        <p className="mt-1 text-[12px] font-semibold text-brand-secondary-text">
                          {formatScheduleDate(order.date)} · {getSlotLabel(order.timeSlotId)}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold",
                          order.status === "upcoming" && "bg-brand-teal/15 text-brand-accent",
                          order.status === "completed" && "bg-brand-cyan/15 text-brand-accent",
                          order.status === "cancelled" &&
                            "bg-brand-border-subtle text-brand-secondary-text",
                        )}
                      >
                        {getScheduleStatusLabel(order.status)}
                      </span>
                    </div>

                    <p className="mt-3 text-[12px] leading-relaxed text-brand-secondary-text">
                      {order.items.map((item) => `${item.name} ×${item.qty}`).join(", ")}
                    </p>

                    <div className="mt-3 flex items-center justify-between border-t border-brand-border-subtle pt-3">
                      <span className="text-[12px] font-semibold text-brand-secondary-text">
                        Total
                      </span>
                      <span className="text-[14px] font-extrabold text-brand-accent">
                        {formatPrice(order.total)}
                      </span>
                    </div>

                    {open ? (
                      <div className="mt-3 space-y-2.5 rounded-2xl bg-brand-surface p-3">
                        <DetailRow
                          icon={<CalendarClock className="h-4 w-4" />}
                          label="Delivery date"
                          value={formatScheduleDate(order.date)}
                        />
                        <DetailRow
                          icon={<Clock className="h-4 w-4" />}
                          label="Delivery time"
                          value={getSlotLabel(order.timeSlotId)}
                        />
                        <DetailRow
                          icon={<Hourglass className="h-4 w-4" />}
                          label="Delivery window"
                          value={getWindowLabel(order.windowId)}
                        />
                        <DetailRow
                          icon={<MapPin className="h-4 w-4" />}
                          label="Address"
                          value={order.address}
                        />
                        {order.notes ? (
                          <DetailRow
                            icon={<NotebookPen className="h-4 w-4" />}
                            label="Notes"
                            value={order.notes}
                          />
                        ) : null}
                      </div>
                    ) : null}

                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                      <SecondaryButton
                        className="py-3 text-[12px]"
                        onClick={() => setOpenId(open ? null : order.id)}
                      >
                        {open ? "Hide Details" : "View Details"}
                      </SecondaryButton>
                      {order.status === "upcoming" ? (
                        <>
                          <SecondaryButton
                            className="py-3 text-[12px]"
                            onClick={() => editSchedule(order)}
                          >
                            Edit Schedule
                          </SecondaryButton>
                          <SecondaryButton
                            className="border-red-200 py-3 text-[12px] text-red-500 hover:bg-red-50 sm:col-span-2"
                            onClick={() => {
                              cancelSchedule(order.id);
                              toast.success(`Schedule ${order.id} cancelled`);
                            }}
                          >
                            Cancel Schedule
                          </SecondaryButton>
                        </>
                      ) : (
                        <SecondaryButton
                          className="py-3 text-[12px]"
                          onClick={() => {
                            replaceWith(order.productIds);
                            toast.success("Scheduled order added to your cart");
                            navigate({ to: "/cart" });
                          }}
                        >
                          Reorder
                        </SecondaryButton>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </Screen>
      <BottomNav />
    </>
  );
}

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 shrink-0 text-brand-accent">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-brand-secondary-text">
          {label}
        </p>
        <p className="text-[12px] font-bold leading-relaxed text-brand-navy-deep">{value}</p>
      </div>
    </div>
  );
}

export default ScheduledOrdersScreen;
