"use client";

import { useNavigate } from "@/lib/router-compat";import { useState } from "react";
import {
  Bell,
  CalendarClock,
  ChevronDown,
  ChevronRight,
  MapPin,
  Mic,
  Search,
  ShoppingCart,
} from "lucide-react";
import { toast } from "sonner";
import { RetailAILogo } from "@/components/brand/RetailAILogo";
import { BottomNav } from "@/components/shop/nav";
import {
  Card,
  Screen,
  SectionHeader,
} from "@/components/shop/primitives";
import { CategoryStrip, ProductCollection, ProductGrid } from "@/components/shop/collections";

import { useCart } from "@/lib/cart";
import { useCustomerProfile } from "@/lib/customer-profile";
import {
  CATEGORIES,
  DELIVERY_LOCATION,
  getCollections,
  queryProducts,
  type Product,
} from "@/lib/catalog";



function HomeScreen() {
  const navigate = useNavigate();
  const { add, count } = useCart();
  const { profile } = useCustomerProfile();
  // Delivery address comes from the centralized customer profile state.
  const deliveryAddress = profile.address || DELIVERY_LOCATION.value;
  const collections = getCollections(["recommended", "most-ordered"]);
  const [query, setQuery] = useState("");
  const searching = query.trim().length > 0;
  const results = searching ? queryProducts({ query }) : [];

  const openProduct = (product: Product) =>
    navigate({ to: "/menu", search: { product: product.id } });
  const addProduct = (product: Product) => {
    add(product.id);
    toast.success(`${product.name} added to cart`);
  };

  return (
    <>
      <Screen>
        <header className="relative flex items-center justify-center">
          <button
            type="button"
            aria-label="Notifications"
            onClick={() => navigate({ to: "/notifications" })}
            className="absolute start-0 top-1/2 -translate-y-1/2 rounded-lg p-1 text-brand-navy-deep transition-colors hover:text-brand-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan"
          >
            <Bell className="h-6 w-6" />
          </button>
          <RetailAILogo className="text-[1.6rem] sm:text-[1.75rem] lg:text-3xl" />
          <button
            type="button"
            aria-label={`Cart, ${count} item${count === 1 ? "" : "s"}`}
            onClick={() => navigate({ to: "/cart" })}
            className="absolute end-0 top-1/2 -translate-y-1/2 rounded-lg p-1 text-brand-navy-deep transition-colors hover:text-brand-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan"
          >
            <ShoppingCart className="h-6 w-6" />
            {count > 0 ? (
              <span className="absolute -end-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-brand-teal px-1 text-[10px] font-bold text-white">
                {count}
              </span>
            ) : null}
          </button>
        </header>

        {/* Delivery location */}
        <button
          type="button"
          onClick={() => navigate({ to: "/address" })}
          className="mt-6 flex w-full items-center gap-2 rounded-xl px-1 py-1 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan"
        >
          <MapPin className="h-5 w-5 shrink-0 text-brand-accent" />
          <span className="min-w-0">
            <span className="block text-[11px] text-brand-secondary-text ">
              {DELIVERY_LOCATION.label}
            </span>
            <span className="flex items-center gap-1 text-[13px] font-bold text-brand-navy-deep ">
              <span className="truncate">{deliveryAddress}</span>
              <ChevronDown className="h-4 w-4 shrink-0" />
            </span>
          </span>
        </button>

        {/* Search */}
        <div className="mt-3 flex h-13 items-center gap-2 rounded-full border border-brand-border-subtle bg-white ps-4 pe-3 shadow-[0_10px_24px_-18px_rgba(7,27,51,0.3)] focus-within:ring-2 focus-within:ring-brand-cyan/60 lg:h-14">
          <Search className="h-4.5 w-4.5 shrink-0 text-brand-muted" />
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search products, restaurants, groceries..."
            aria-label="Search products, restaurants, groceries"
            className="h-full min-w-0 flex-1 bg-transparent text-sm text-brand-navy-deep placeholder:text-brand-muted focus:outline-none "
          />
          {searching ? (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setQuery("")}
              className="shrink-0 text-[11px] font-bold text-brand-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan"
            >
              Clear
            </button>
          ) : null}
          <button
            type="button"
            aria-label="Search by voice"
            onClick={() => navigate({ to: "/voice" })}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-brand-accent transition-colors hover:bg-brand-teal/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan"
          >
            <Mic className="h-4.5 w-4.5" />
          </button>
        </div>

        {/* Live search results replace the browse sections while typing */}
        {searching ? (
          <section className="mt-6">
            <SectionHeader
              title={`${results.length} result${results.length === 1 ? "" : "s"} for "${query.trim()}"`}
            />
            {results.length > 0 ? (
              <ProductGrid products={results} columns={2} onOpen={openProduct} onAdd={addProduct} />
            ) : (
              <Card className="mt-3 text-center text-[13px] text-brand-secondary-text ">
                Nothing matched your search. Try another product or ask the assistant.
              </Card>
            )}
          </section>
        ) : (
          <>
            {/* Voice ordering hero */}
            <section className="mt-6 lg:mt-8">
              <div className="relative overflow-hidden rounded-3xl border border-brand-border-subtle bg-gradient-to-br from-brand-teal/10 via-white to-brand-cyan/10 p-5 shadow-[0_18px_40px_-28px_rgba(7,27,51,0.35)] sm:p-6 lg:p-8">
                <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-10">
                  <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:items-center sm:gap-5 sm:text-start lg:gap-6">
                    <div className="min-w-0">
                      <h2 className="text-xl font-extrabold text-brand-navy-deep sm:text-2xl lg:text-3xl">
                        Order with your voice
                      </h2>
                      <p className="mt-2 text-[13px] leading-relaxed text-brand-secondary-text sm:text-sm lg:text-base">
                        Speak naturally in Urdu or English — RetailAI understands your order and
                        builds your cart.
                      </p>
                    </div>
                  </div>

                  <div className="flex w-full flex-col gap-3 lg:w-64">
                    <button
                      type="button"
                      onClick={() => navigate({ to: "/voice" })}
                      className="bg-brand-gradient flex h-12 w-full items-center justify-center gap-2 rounded-full text-sm font-bold text-white shadow-[0_16px_30px_-14px_rgba(0,160,175,0.75)] transition-transform hover:scale-[1.02] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan sm:text-base lg:h-13"
                    >
                      <Mic className="h-4.5 w-4.5" /> Start Voice Order
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate({ to: "/menu" })}
                      className="flex h-12 w-full items-center justify-center rounded-full border border-brand-teal/50 bg-white/70 text-sm font-bold text-brand-accent transition-colors hover:bg-brand-teal/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan sm:text-base lg:h-13"
                    >
                      Type Instead
                    </button>
                  </div>
                </div>
              </div>
            </section>




            {/* Scheduled orders entry */}
            <section className="mt-4">
              <button
                type="button"
                onClick={() => navigate({ to: "/scheduled-orders" })}
                className="flex w-full items-center gap-3 rounded-2xl border border-brand-border-subtle bg-white px-4 py-3.5 text-start shadow-[0_10px_24px_-18px_rgba(7,27,51,0.3)] transition-colors hover:border-brand-teal/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan"
              >
                <span className="bg-brand-gradient grid h-9 w-9 shrink-0 place-items-center rounded-full text-white">
                  <CalendarClock className="h-4.5 w-4.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-bold text-brand-navy-deep lg:text-sm">
                    My Scheduled Orders
                  </span>
                  <span className="block truncate text-[11px] text-brand-secondary-text lg:text-xs">
                    Pre-order for a date and time that suits you
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-brand-secondary-text rtl:-scale-x-100" />
              </button>
            </section>

            {/* Categories */}
            <section className="mt-8">
              <SectionHeader
                title="Categories"
                actionLabel="See All"
                onAction={() => navigate({ to: "/menu" })}
              />
              <CategoryStrip
                categories={CATEGORIES}
                onSelect={(category) =>
                  navigate({ to: "/menu", search: { category: category.id } })
                }
              />
            </section>

            {/* Data-driven product collections */}
            {collections.map((collection) => (
              <ProductCollection
                key={collection.id}
                collection={collection}
                onAction={() => navigate({ to: "/menu" })}
                onOpen={openProduct}
                onAdd={addProduct}
              />
            ))}
          </>
        )}
      </Screen>
      <BottomNav />
    </>
  );
}

export default HomeScreen;
