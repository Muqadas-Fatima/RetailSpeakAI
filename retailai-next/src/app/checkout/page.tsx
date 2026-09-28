"use client";

import { useNavigate } from "@/lib/router-compat";import { useState } from "react";
import {
  CalendarClock,
  CreditCard,
  MapPin,
  Pencil,
  Phone,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { BottomNav } from "@/components/shop/nav";
import {
  Card,
  PrimaryButton,
  Screen,
  ScreenHeader,
  SecondaryButton,
  StickyBar,
} from "@/components/shop/primitives";
import { useCart } from "@/lib/cart";
import { useCustomerProfile } from "@/lib/customer-profile";
import { CHECKOUT, PAYMENT_METHODS, formatPrice, getProduct } from "@/lib/catalog";
import { useOrders } from "@/lib/orders";
import { useScheduledOrders } from "@/lib/scheduled-orders";
import { cn } from "@/lib/utils";



/** Icon registry: payment methods come from mock JSON, icons are resolved by key. */
const PAYMENT_ICONS: Record<string, LucideIcon> = {
  wallet: Wallet,
  phone: Phone,
  card: CreditCard,
};

function CheckoutScreen() {
  const navigate = useNavigate();
  const { lines, subtotal, deliveryFee, discount, total, clear } = useCart();
  const { placeOrder: createOrder } = useOrders();
  const { profile } = useCustomerProfile();
  const { setDraft } = useScheduledOrders();
  const [payment, setPayment] = useState(PAYMENT_METHODS[0]?.id ?? "cod");
  const [instructions, setInstructions] = useState("");

  const placeOrder = () => {
    if (lines.length === 0) {
      toast("Your cart is empty");
      return;
    }
    const order = createOrder({
      lines,
      total,
      paymentMethodId: payment,
      ...(instructions.trim() ? { instructions: instructions.trim() } : {}),
    });
    clear();
    toast.success(`Order ${order.id} placed`);
    navigate({ to: "/confirmation", search: { order: order.id } });
  };

  return (
    <>
      <Screen className="pb-40">
        <ScreenHeader title="Checkout" backTo="/cart" />

        <SectionLabel>Deliver to</SectionLabel>
        <Card className="flex items-start gap-3">
          <span className="bg-brand-gradient grid h-9 w-9 shrink-0 place-items-center rounded-full text-white">
            <MapPin className="h-4.5 w-4.5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-bold text-brand-navy-deep ">{CHECKOUT.address.label}</p>
            <p className="text-[11px] text-brand-secondary-text ">{profile.address}</p>
          </div>
          <button
            type="button"
            onClick={() => navigate({ to: "/address" })}
            className="shrink-0 text-[12px] font-semibold text-brand-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan"
          >
            Change
          </button>
        </Card>

        <SectionLabel>Contact Information</SectionLabel>
        <Card className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-bold text-brand-navy-deep ">{profile.fullName}</p>
            <p className="text-[11px] text-brand-secondary-text ">{profile.phone}</p>
          </div>
          <button
            type="button"
            aria-label="Edit contact information"
            onClick={() => navigate({ to: "/profile" })}
            className="rounded-lg p-1 text-brand-muted transition-colors hover:text-brand-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan"
          >
            <Pencil className="h-4 w-4" />
          </button>
        </Card>

        <SectionLabel>Order Summary</SectionLabel>
        <Card className="space-y-2.5">
          {lines.map((line) => {
            const product = getProduct(line.id);
            if (!product) return null;
            return (
              <div key={line.id} className="flex items-center justify-between text-[12px]">
                <span className="min-w-0 truncate text-brand-navy-deep ">
                  {product.name} ×{line.qty}
                </span>
                <span className="shrink-0 font-bold text-brand-navy-deep ">
                  {formatPrice(product.price * line.qty)}
                </span>
              </div>
            );
          })}
          <div className="space-y-1.5 border-t border-brand-border-subtle pt-2.5 text-[12px] ">
            <Row label="Subtotal" value={formatPrice(subtotal)} />
            <Row label="Delivery Fee" value={formatPrice(deliveryFee)} />
            <Row label="Discount" value={`− ${formatPrice(discount)}`} />
          </div>
        </Card>

        <SectionLabel>Delivery Instructions (Optional)</SectionLabel>
        <Card className="p-3">
          <textarea
            value={instructions}
            onChange={(event) => setInstructions(event.target.value)}
            placeholder="Add delivery instructions…"
            rows={3}
            className="w-full resize-none bg-transparent text-[13px] text-brand-navy-deep placeholder:text-brand-muted focus:outline-none "
          />
        </Card>

        <SectionLabel>Payment Method</SectionLabel>
        <Card className="space-y-2">
          {PAYMENT_METHODS.map((option) => {
            const Icon = PAYMENT_ICONS[option.icon] ?? Wallet;
            const active = payment === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setPayment(option.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-start transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan",
                  active
                    ? "border-brand-teal bg-brand-teal/5"
                    : "border-brand-border-subtle hover:border-brand-teal/40 ",
                )}
              >
                <Icon className="h-4.5 w-4.5 shrink-0 text-brand-accent" />
                <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-brand-navy-deep ">
                  {option.label}
                </span>
                <span
                  className={cn(
                    "grid h-4.5 w-4.5 shrink-0 place-items-center rounded-full border-2",
                    active ? "border-brand-teal" : "border-brand-border ",
                  )}
                >
                  {active ? <span className="h-2 w-2 rounded-full bg-brand-teal" /> : null}
                </span>
              </button>
            );
          })}
        </Card>
      </Screen>

      <StickyBar>
        <div className="space-y-2">
          <SecondaryButton
            className="py-3 text-[13px]"
            onClick={() => {
              if (lines.length === 0) {
                toast("Your cart is empty");
                return;
              }
              setDraft(null);
              navigate({ to: "/pre-order" });
            }}
          >
            <CalendarClock className="h-4 w-4" /> Schedule Order
          </SecondaryButton>
          <div className="flex items-center gap-3 rounded-full border border-brand-border-subtle bg-white p-2 ps-5 shadow-[0_18px_36px_-14px_rgba(0,160,175,0.4)] ">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] text-brand-secondary-text ">Total Amount</p>
              <p className="text-[15px] font-extrabold text-brand-navy-deep ">
                {formatPrice(total)}
              </p>
            </div>
            <PrimaryButton onClick={placeOrder} className="w-auto shrink-0 px-6 py-3">
              Order Now
            </PrimaryButton>
          </div>
        </div>
      </StickyBar>
      <BottomNav />
    </>
  );
}

function SectionLabel({ children }: { children: string }) {
  return <h2 className="mb-2 mt-6 text-[13px] font-bold text-brand-navy-deep ">{children}</h2>;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-brand-secondary-text ">{label}</span>
      <span className="font-bold text-brand-navy-deep ">{value}</span>
    </div>
  );
}

export default CheckoutScreen;
