"use client";
/**
 * Reusable, data-driven list/collection components.
 * Every one of these renders from plain DTOs (mock JSON today, API later) and
 * contains no business-specific copy.
 */
import {
  Bell,
  CalendarClock,
  ChevronRight,
  ClipboardList,
  CreditCard,
  FileText,
  Globe,
  HelpCircle,
  Info,
  Key,
  LogOut,
  Mail,
  MapPin,
  Moon,
  Plus,
  ScrollText,
  Shield,
  Star,
  User,
  type LucideIcon,
} from "lucide-react";
import { Card, ProductCard, Rating, SectionHeader } from "@/components/shop/primitives";
import {
  formatPrice,
  type Category,
  type Collection,
  type CustomizationGroup,
  type Order,
  type OrderStatus,
  type Product,
  type ProfileRow,
  type ProfileSection,
} from "@/lib/catalog";
import { cn } from "@/lib/utils";

/* ------------------------------- Categories ------------------------------- */

export function CategoryStrip({
  categories,
  onSelect,
}: {
  categories: Category[];
  onSelect: (category: Category) => void;
}) {
  return (
    <div className="scroll-rail -mx-5 mt-3.5 flex snap-x gap-3 overflow-x-auto px-5 pb-2 lg:-mx-10 lg:px-10">
      {categories.map((category) => (
        <button
          key={category.id}
          type="button"
          onClick={() => onSelect(category)}
          className="flex w-20 shrink-0 snap-start flex-col items-center gap-2 rounded-2xl border border-brand-border-subtle bg-white px-2 py-3.5 shadow-[0_10px_24px_-16px_rgba(7,27,51,0.25)] transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan lg:w-24 lg:py-5"
        >
          <img
            src={category.image}
            alt=""
            aria-hidden
            width={512}
            height={512}
            loading="lazy"
            className="h-12 w-12 object-contain lg:h-14 lg:w-14"
          />
          <span className="w-full truncate text-center text-[11px] font-semibold text-brand-navy-deep lg:text-xs">
            {category.name}
          </span>
        </button>
      ))}
    </div>
  );
}

/* --------------------------- Product collections -------------------------- */

export function ProductGrid({
  products,
  onOpen,
  onAdd,
  columns = 4,
}: {
  products: Product[];
  onOpen: (product: Product) => void;
  onAdd: (product: Product) => void;
  columns?: 2 | 3 | 4;
}) {
  return (
    <div
      className={cn(
        "mt-3.5 grid gap-2.5 sm:gap-3 lg:gap-4",
        columns === 2 && "grid-cols-2",
        columns === 3 && "grid-cols-3",
        columns === 4 && "grid-cols-4",
      )}
    >
      {products.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          onOpen={() => onOpen(product)}
          onAdd={() => onAdd(product)}
        />
      ))}
    </div>
  );
}

/** Section header + product grid, driven entirely by a Collection DTO. */
export function ProductCollection({
  collection,
  onAction,
  onOpen,
  onAdd,
  columns,
  className,
}: {
  collection: Collection;
  onAction?: () => void;
  onOpen: (product: Product) => void;
  onAdd: (product: Product) => void;
  columns?: 2 | 3 | 4;
  className?: string;
}) {
  if (collection.products.length === 0) return null;
  return (
    <section className={cn("mt-6", className)}>
      <SectionHeader
        title={collection.title}
        {...(collection.actionLabel ? { actionLabel: collection.actionLabel } : {})}
        {...(onAction ? { onAction } : {})}
      />
      <ProductGrid
        products={collection.products}
        onOpen={onOpen}
        onAdd={onAdd}
        {...(columns ? { columns } : {})}
      />
    </section>
  );
}

/** Horizontal product rows (menu style). */
export function ProductRowList({
  products,
  onOpen,
  onAdd,
  emptyLabel = "Nothing here yet.",
  availableLabel = "Available",
  soldOutLabel = "Sold out",
}: {
  products: Product[];
  onOpen: (product: Product) => void;
  onAdd: (product: Product) => void;
  emptyLabel?: string;
  availableLabel?: string;
  soldOutLabel?: string;
}) {
  if (products.length === 0) {
    return (
      <Card className="mt-4 text-center text-sm text-brand-secondary-text ">{emptyLabel}</Card>
    );
  }
  return (
    <div className="mt-4 space-y-3">
      {products.map((product) => (
        <Card key={product.id} className="flex items-center gap-3 p-3">
          <button
            type="button"
            onClick={() => onOpen(product)}
            className="flex min-w-0 flex-1 items-center gap-3 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan"
          >
            <img
              src={product.image}
              alt={product.name}
              width={512}
              height={512}
              loading="lazy"
              className="h-16 w-16 shrink-0 rounded-xl object-contain lg:h-20 lg:w-20"
            />
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-bold text-brand-navy-deep lg:text-sm">
                {product.name}
              </span>
              <span className="mt-0.5 block truncate text-[11px] text-brand-secondary-text lg:text-xs">
                {product.description}
              </span>
              <span className="mt-1.5 flex items-center gap-2">
                <span className="text-[12px] font-bold text-brand-accent lg:text-sm">
                  {formatPrice(product.price)}
                </span>
                <Rating value={product.rating} />
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[9px] font-bold",
                    product.available
                      ? "bg-brand-teal/10 text-brand-accent"
                      : "bg-brand-muted/15 text-brand-muted",
                  )}
                >
                  {product.available ? availableLabel : soldOutLabel}
                </span>
              </span>
            </span>
          </button>
          <button
            type="button"
            aria-label={`Add ${product.name}`}
            onClick={() => onAdd(product)}
            className="bg-brand-gradient flex h-8 shrink-0 items-center gap-1 rounded-full px-3 text-[11px] font-bold text-white transition-transform hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan lg:text-xs"
          >
            <Plus className="h-3 w-3" /> Add
          </button>
        </Card>
      ))}
    </div>
  );
}

/* ---------------------------------- Tabs ---------------------------------- */

export function FilterTabs<T extends { id: string; label: string }>({
  tabs,
  activeId,
  onChange,
  variant = "pill",
}: {
  tabs: T[];
  activeId: string;
  onChange: (tab: T) => void;
  variant?: "pill" | "underline";
}) {
  if (variant === "underline") {
    return (
      <div className="scroll-rail -mx-5 mt-5 flex gap-6 overflow-x-auto border-b border-brand-border-subtle px-5 lg:-mx-10 lg:px-10">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab)}
            className={cn(
              "shrink-0 border-b-2 pb-2.5 text-[13px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan lg:text-sm",
              tab.id === activeId
                ? "border-brand-teal text-brand-accent"
                : "border-transparent text-brand-secondary-text hover:text-brand-accent ",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
    );
  }
  return (
    <div className="scroll-rail mt-5 flex gap-2 overflow-x-auto pb-1">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab)}
          className={cn(
            "shrink-0 rounded-full px-4 py-2 text-[12px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan",
            tab.id === activeId
              ? "bg-brand-gradient text-white shadow-[0_10px_20px_-10px_rgba(0,160,175,0.7)]"
              : "border border-brand-border-subtle bg-white text-brand-secondary-text hover:text-brand-accent ",
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

/* --------------------------------- Orders --------------------------------- */

export function OrderList({
  orders,
  statusLabel,
  onViewDetails,
  onReorder,
  detailsLabel = "View Details",
  reorderLabel = "Reorder",
  itemsLabel = "items",
  emptyLabel = "No orders in this tab yet.",
}: {
  orders: Order[];
  statusLabel: (status: OrderStatus) => string;
  onViewDetails: (order: Order) => void;
  onReorder: (order: Order) => void;
  detailsLabel?: string;
  reorderLabel?: string;
  itemsLabel?: string;
  emptyLabel?: string;
}) {
  if (orders.length === 0) {
    return (
      <Card className="mt-4 text-center text-[13px] text-brand-secondary-text ">{emptyLabel}</Card>
    );
  }
  return (
    <div className="mt-4 space-y-3">
      {orders.map((order) => (
        <Card key={order.id}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-[13px] font-bold text-brand-navy-deep ">
                Order #{order.id}
              </p>
              <p className="mt-0.5 text-[11px] text-brand-secondary-text ">
                {order.date} · {order.items.length} {itemsLabel}
              </p>
              <p className="mt-1.5 text-[14px] font-extrabold text-brand-navy-deep ">
                {formatPrice(order.total)}
              </p>
            </div>
            <span
              className={cn(
                "shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold",
                order.status === "cancelled"
                  ? "bg-destructive/10 text-brand-danger"
                  : "bg-brand-teal/10 text-brand-accent",
              )}
            >
              {statusLabel(order.status)}
            </span>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => onViewDetails(order)}
              className="h-9 flex-1 rounded-full border border-brand-teal/40 text-[12px] font-bold text-brand-accent transition-colors hover:bg-brand-teal/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan"
            >
              {detailsLabel}
            </button>
            <button
              type="button"
              onClick={() => onReorder(order)}
              className="bg-brand-gradient h-9 flex-1 rounded-full text-[12px] font-bold text-white transition-transform hover:scale-[1.02] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan"
            >
              {reorderLabel}
            </button>
          </div>
        </Card>
      ))}
    </div>
  );
}

/* ------------------------------ Option groups ----------------------------- */

export function OptionGroupList({
  groups,
  values,
  onChange,
}: {
  groups: CustomizationGroup[];
  values: Record<string, string>;
  onChange: (groupId: string, value: string) => void;
}) {
  return (
    <>
      {groups.map((group) => (
        <div key={group.id} className="mt-3">
          <p className="text-[12px] font-semibold text-brand-secondary-text ">{group.label}</p>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {group.options.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => onChange(group.id, option)}
                className={cn(
                  "rounded-full border px-3.5 py-1.5 text-[12px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan",
                  values[group.id] === option
                    ? "border-brand-teal bg-brand-teal/10 text-brand-accent"
                    : "border-brand-border-subtle bg-white text-brand-secondary-text hover:text-brand-accent ",
                )}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

/* --------------------------------- Profile -------------------------------- */

const PROFILE_ICONS: Record<string, LucideIcon> = {
  user: User,
  key: Key,
  mail: Mail,
  "map-pin": MapPin,
  "credit-card": CreditCard,
  "clipboard-list": ClipboardList,
  "calendar-clock": CalendarClock,
  globe: Globe,
  moon: Moon,
  bell: Bell,
  shield: Shield,
  "help-circle": HelpCircle,
  info: Info,
  "file-text": FileText,
  scroll: ScrollText,
  star: Star,
  "log-out": LogOut,
};

export function ProfileSectionList({
  sections,
  values = {},
  onSelect,
}: {
  sections: ProfileSection[];
  values?: Record<string, string>;
  onSelect: (row: ProfileRow) => void;
}) {
  return (
    <>
      {sections.map((section) => (
        <section key={section.id} className="mt-4 lg:mt-6">
          <h2 className="px-1 text-[12px] font-bold uppercase tracking-wide text-brand-secondary-text ">
            {section.title}
          </h2>
          <Card className="mt-2 divide-y divide-brand-border-subtle p-0 ">
            {section.rows.map((row) => {
              const Icon = PROFILE_ICONS[row.icon] ?? Info;
              const value = row.valueKey ? values[row.valueKey] : undefined;
              return (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => onSelect(row)}
                  className="flex w-full items-center gap-3 px-4 py-4 text-start transition-colors hover:bg-brand-teal/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan"
                >
                  <Icon className="h-5 w-5 shrink-0 text-brand-accent" />
                  <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-brand-navy-deep lg:text-sm">
                    {row.label}
                  </span>
                  {value ? (
                    <span className="shrink-0 text-[12px] font-semibold text-brand-secondary-text ">
                      {value}
                    </span>
                  ) : null}
                  <ChevronRight className="h-4 w-4 shrink-0 text-brand-secondary-text rtl:-scale-x-100 " />
                </button>
              );
            })}
          </Card>
        </section>
      ))}
    </>
  );
}
