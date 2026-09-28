"use client";

import { useNavigate } from "@/lib/router-compat";import { Sparkle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { BottomNav } from "@/components/shop/nav";
import {
  Card,
  PrimaryButton,
  QtyStepper,
  Screen,
  ScreenHeader,
  SecondaryButton,

  SectionHeader,
  StickyBar,
} from "@/components/shop/primitives";
import { useCart } from "@/lib/cart";
import { formatPrice, getCollection, getProduct } from "@/lib/catalog";



function CartScreen() {
  const navigate = useNavigate();
  const suggestions = getCollection("cart-suggestions");
  const { lines, setQty, remove, clear, subtotal, deliveryFee, discount, total, add } = useCart();

  return (
    <>
      <Screen className="pb-40">
        <ScreenHeader
          title="My Cart"
          backTo="/home"
          right={
            <button
              type="button"
              onClick={() => {
                clear();
                toast("Cart cleared");
              }}
              className="text-[12px] font-semibold text-brand-accent transition-colors hover:text-brand-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan"
            >
              Clear Cart
            </button>
          }
        />

        {lines.length === 0 ? (
          <Card className="mt-6 text-center">
            <p className="text-sm font-semibold text-brand-navy-deep ">Your cart is empty</p>
            <p className="mt-1 text-[12px] text-brand-secondary-text ">
              Start a voice order and RetailAI will fill it for you.
            </p>
            <div className="mt-4 space-y-2.5">
              <PrimaryButton onClick={() => navigate({ to: "/voice" })}>
                Start Voice Order
              </PrimaryButton>
              <SecondaryButton onClick={() => navigate({ to: "/menu" })}>
                Continue Shopping
              </SecondaryButton>
            </div>
          </Card>
        ) : (
          <div className="mt-5 space-y-3">
            {lines.map((line) => {
              const product = getProduct(line.id);
              if (!product) return null;
              return (
                <Card key={line.id} className="flex items-center gap-3 p-3">
                  <img
                    src={product.image}
                    alt={product.name}
                    width={512}
                    height={512}
                    loading="lazy"
                    className="h-14 w-14 shrink-0 object-contain lg:h-16 lg:w-16"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-bold text-brand-navy-deep lg:text-sm">
                      {product.name}
                    </p>
                    <p className="text-[11px] text-brand-secondary-text ">
                      {formatPrice(product.price)}
                      {line.options?.length ? ` · ${line.options.join(", ")}` : ""}
                    </p>
                    <div className="mt-2">
                      <QtyStepper qty={line.qty} onChange={(next) => setQty(line.id, next)} />
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <span className="text-[13px] font-bold text-brand-navy-deep ">
                      {formatPrice(product.price * line.qty)}
                    </span>
                    <button
                      type="button"
                      aria-label={`Remove ${product.name}`}
                      onClick={() => remove(line.id)}
                      className="rounded-lg p-1 text-brand-muted transition-colors hover:text-brand-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* AI suggestions */}
        <section className="mt-7">
          <Card className="bg-brand-surface-2/60 ">
            <div className="flex items-center gap-2">
              <span className="bg-brand-gradient grid h-7 w-7 shrink-0 place-items-center rounded-full text-white">
                <Sparkle className="h-4 w-4" />
              </span>
              <SectionHeader title={suggestions?.title ?? "You may also like"} />
            </div>
            <p className="mt-1 text-[11px] text-brand-secondary-text ">
              Picked by RetailAI based on your order.
            </p>
            <div className="mt-3 space-y-2">
              {(suggestions?.products ?? []).map((product) => {
                return (
                  <div
                    key={product.id}
                    className="flex items-center gap-3 rounded-xl border border-brand-border-subtle bg-white p-2.5 "
                  >
                    <img
                      src={product.image}
                      alt={product.name}
                      width={512}
                      height={512}
                      loading="lazy"
                      className="h-10 w-10 shrink-0 object-contain"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12px] font-bold text-brand-navy-deep ">
                        {product.name}
                      </p>
                      <p className="text-[11px] text-brand-accent">{formatPrice(product.price)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        add(product.id);
                        toast.success(`${product.name} added to cart`);
                      }}
                      className="bg-brand-gradient h-7 shrink-0 rounded-full px-3.5 text-[11px] font-bold text-white transition-transform hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan"
                    >
                      + Add
                    </button>
                  </div>
                );
              })}
            </div>
          </Card>
        </section>

        {/* Price summary */}
        <section className="mt-5">
          <Card className="space-y-2.5">
            <SummaryRow label="Subtotal" value={formatPrice(subtotal)} />
            <SummaryRow label="Delivery Fee" value={formatPrice(deliveryFee)} />
            <SummaryRow label="Discount" value={`− ${formatPrice(discount)}`} accent />
            <div className="border-t border-brand-border-subtle pt-2.5 ">
              <div className="flex items-center justify-between">
                <span className="text-[14px] font-extrabold text-brand-navy-deep ">Total</span>
                <span className="text-[15px] font-extrabold text-brand-accent">
                  {formatPrice(total)}
                </span>
              </div>
            </div>
          </Card>
        </section>
      </Screen>

      {lines.length > 0 ? (
        <StickyBar>
          <PrimaryButton
            onClick={() => navigate({ to: "/checkout" })}
            className="shadow-[0_18px_36px_-14px_rgba(0,160,175,0.5)]"
          >
            Proceed to Checkout — {formatPrice(total)}
          </PrimaryButton>
        </StickyBar>
      ) : null}
      <BottomNav />
    </>
  );
}

function SummaryRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between text-[12px] lg:text-sm">
      <span className="text-brand-secondary-text ">{label}</span>
      <span className={accent ? "font-bold text-brand-accent" : "font-bold text-brand-navy-deep "}>
        {value}
      </span>
    </div>
  );
}

export default CartScreen;
