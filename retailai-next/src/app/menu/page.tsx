"use client";

import { Suspense } from "react";

import { useNavigate, useSearch } from "@/lib/router-compat";import { useState } from "react";
import { Search } from "lucide-react";
import { toast } from "sonner";
import { BottomNav } from "@/components/shop/nav";
import { FilterTabs, OptionGroupList, ProductRowList } from "@/components/shop/collections";
import {
  CartButton,
  PrimaryButton,
  QtyStepper,
  Rating,
  Screen,
  ScreenHeader,
} from "@/components/shop/primitives";
import { useCart } from "@/lib/cart";
import {
  CATEGORIES,
  CUSTOMIZATION_GROUPS,
  MENU_TABS,
  PRODUCT_FILTERS,
  SORT_OPTIONS,
  queryProducts,
  formatPrice,
  getDefaultCustomizations,
  getProduct,
  type Product,
} from "@/lib/catalog";

type MenuSearch = { product?: string; category?: string; query?: string };



function MenuScreen() {
  const navigate = useNavigate();
  const { add } = useCart();
  const { product: openProductId, category, query: initialQuery } = useSearch();
  const [tab, setTab] = useState<string>(MENU_TABS[0]?.id ?? "");
  const [query, setQuery] = useState(initialQuery ?? "");
  const [showSearch, setShowSearch] = useState(Boolean(initialQuery));
  const [sort, setSort] = useState<string>(SORT_OPTIONS[0]?.id ?? "popular");
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const activeCategory = category ? CATEGORIES.find((item) => item.id === category) : undefined;

  const items = queryProducts({
    query,
    sort,
    availableOnly: activeFilters.includes("available"),
    ...(activeCategory ? { categoryId: activeCategory.id } : query ? {} : { tab }),
  });
  const openProduct = openProductId ? getProduct(openProductId) : undefined;

  const toggleFilter = (id: string) =>
    setActiveFilters((prev) => (prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]));

  return (
    <>
      <Screen>
        <ScreenHeader
          title={activeCategory ? activeCategory.name : "Menu"}
          backTo="/home"
          right={
            <>
              <button
                type="button"
                aria-label="Search menu"
                aria-pressed={showSearch}
                onClick={() => {
                  setShowSearch((value) => !value);
                  if (showSearch) setQuery("");
                }}
                className="rounded-lg p-1 text-brand-navy-deep transition-colors hover:text-brand-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan "
              >
                <Search className="h-5 w-5" />
              </button>
              <CartButton />
            </>
          }
        />

        {showSearch ? (
          <div className="mt-3 flex h-11 items-center gap-2 rounded-xl border border-brand-border bg-white px-3 ">
            <Search className="h-4 w-4 shrink-0 text-brand-muted" />
            <input
              type="text"
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search the menu..."
              aria-label="Search the menu"
              className="h-full min-w-0 flex-1 bg-transparent text-sm text-brand-navy-deep placeholder:text-brand-muted focus:outline-none "
            />
          </div>
        ) : null}

        {activeCategory ? (
          <button
            type="button"
            onClick={() => navigate({ to: "/menu", search: {} })}
            className="mt-3 inline-flex items-center gap-1 rounded-full bg-brand-teal/10 px-3 py-1.5 text-[11px] font-bold text-brand-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan"
          >
            {activeCategory.name} · clear filter
          </button>
        ) : (
          <FilterTabs
            tabs={MENU_TABS}
            activeId={tab}
            onChange={(next) => setTab(next.id)}
            variant="underline"
          />
        )}

        {/* Config-driven sort + filter controls */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {SORT_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              aria-pressed={sort === option.id}
              onClick={() => setSort(option.id)}
              className={
                sort === option.id
                  ? "rounded-full bg-brand-navy-deep px-3 py-1.5 text-[11px] font-bold text-white"
                  : "rounded-full border border-brand-border px-3 py-1.5 text-[11px] font-semibold text-brand-secondary-text "
              }
            >
              {option.label}
            </button>
          ))}
          {PRODUCT_FILTERS.map((filter) => (
            <button
              key={filter.id}
              type="button"
              aria-pressed={activeFilters.includes(filter.id)}
              onClick={() => toggleFilter(filter.id)}
              className={
                activeFilters.includes(filter.id)
                  ? "rounded-full bg-brand-teal px-3 py-1.5 text-[11px] font-bold text-white"
                  : "rounded-full border border-brand-border px-3 py-1.5 text-[11px] font-semibold text-brand-secondary-text "
              }
            >
              {filter.label}
            </button>
          ))}
        </div>

        {items.length === 0 ? (
          <p className="mt-8 text-center text-[13px] text-brand-secondary-text ">
            No items match your search or filters.
          </p>
        ) : null}

        <ProductRowList
          products={items}
          onOpen={(product) =>
            navigate({
              to: "/menu",
              search: {
                product: product.id,
                ...(category ? { category } : {}),
                ...(query ? { query } : {}),
              },
            })
          }
          onAdd={(product) => {
            if (!product.available) {
              toast("This item is currently sold out");
              return;
            }
            add(product.id);
            toast.success(`${product.name} added to cart`);
          }}
        />
      </Screen>
      <BottomNav />

      {openProduct ? (
        <ProductDetailsSheet
          product={openProduct}
          onClose={() =>
            navigate({
              to: "/menu",
              search: {
                ...(category ? { category } : {}),
                ...(query ? { query } : {}),
              },
            })
          }
        />
      ) : null}
    </>
  );
}

/** Premium bottom-sheet product details with data-driven customization options. */
function ProductDetailsSheet({ product, onClose }: { product: Product; onClose: () => void }) {
  const { add } = useCart();
  const navigate = useNavigate();
  const [options, setOptions] = useState<Record<string, string>>(() => getDefaultCustomizations());
  const [qty, setQty] = useState(1);

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center">
      <button
        type="button"
        aria-label="Close product details"
        onClick={onClose}
        className="absolute inset-0 bg-brand-navy-deep/50 backdrop-blur-sm"
      />
      <div className="scroll-touch relative max-h-[88svh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-brand-panel sm:max-w-lg lg:max-w-xl">
        <div className="grid place-items-center bg-brand-surface py-6 ">
          <img
            src={product.image}
            alt={product.name}
            width={512}
            height={512}
            className="h-40 w-40 object-contain lg:h-48 lg:w-48"
          />
        </div>
        <div className="px-5 pt-5">
          <div className="flex items-start justify-between gap-3">
            <h2 className="min-w-0 text-[18px] font-extrabold text-brand-navy-deep lg:text-xl">
              {product.name}
            </h2>
            <span className="shrink-0 text-[16px] font-extrabold text-brand-accent lg:text-lg">
              {formatPrice(product.price)}
            </span>
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <Rating value={product.rating} />
            <span className="text-[11px] text-brand-secondary-text ">
              ({product.reviews} reviews)
            </span>
          </div>
          <p className="mt-3 text-[13px] text-brand-secondary-text ">{product.description}.</p>
          <p className="mt-2 text-[12px] text-brand-secondary-text ">
            <span className="font-bold text-brand-navy-deep ">Ingredients: </span>
            {product.ingredients}
          </p>

          <h3 className="mt-5 text-[14px] font-bold text-brand-navy-deep ">Choose Options</h3>
          <OptionGroupList
            groups={CUSTOMIZATION_GROUPS}
            values={options}
            onChange={(groupId, value) => setOptions((prev) => ({ ...prev, [groupId]: value }))}
          />

          <div className="mt-4 flex items-center justify-between">
            <span className="text-[13px] font-bold text-brand-navy-deep ">Quantity</span>
            <QtyStepper qty={qty} onChange={(next) => setQty(Math.max(1, next))} />
          </div>

          <div className="mt-5">
            <PrimaryButton
              onClick={() => {
                add(product.id, qty, Object.values(options));
                toast.success(`${product.name} ×${qty} added to cart`);
                navigate({ to: "/cart" });
              }}
            >
              Add to Cart — {formatPrice(product.price * qty)}
            </PrimaryButton>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MenuScreenPage() {
  return (
    <Suspense fallback={null}>
      <MenuScreen />
    </Suspense>
  );
}

