"use client";
import { Link } from "@/lib/router-compat";
import { ArrowLeft, Minus, Plus, ShoppingCart, Star } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { formatPrice, type Product } from "@/lib/catalog";
import { useCart } from "@/lib/cart";

/** Page shell: brand surface background, centered single column, room for bottom nav. */
export function Screen({
  children,
  className,
  fullWidth,
  fill,
}: {
  children: ReactNode;
  className?: string;
  fullWidth?: boolean;
  /** Lay the inner container out as a full-height flex column so children can
   * use mt-auto / flex-1 (e.g. to pin a chat transcript above a dock). */
  fill?: boolean;
}) {
  return (
    <main className={cn("min-h-[100svh] bg-brand-surface ", className)}>
      <div
        className={cn(
          "w-full px-5 pb-28 pt-6 sm:pt-8 lg:pt-10 lg:px-10",
          fill && "flex min-h-[100svh] flex-col",
        )}
      >
        {children}
      </div>
    </main>
  );
}

export function ScreenHeader({
  title,
  backTo,
  right,
}: {
  title: string;
  backTo?: string;
  right?: ReactNode;
}) {
  return (
    <header className="relative flex h-9 items-center justify-center">
      {backTo ? (
        <Link
          to={backTo}
          aria-label="Back"
          className="absolute start-0 top-1/2 -translate-y-1/2 rounded-lg p-1 text-brand-navy-deep transition-colors hover:text-brand-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan "
        >
          <ArrowLeft className="h-5 w-5 rtl:-scale-x-100" />
        </Link>
      ) : null}
      <h1 className="truncate px-10 text-[16px] font-bold text-brand-navy-deep lg:text-lg">
        {title}
      </h1>
      {right ? (
        <div className="absolute end-0 top-1/2 -translate-y-1/2 flex items-center gap-3">
          {right}
        </div>
      ) : null}
    </header>
  );
}

/** Standard white/navy rounded card with the shared soft floating shadow. */
export function Card({
  children,
  className,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "article" | "section";
}) {
  return (
    <Tag
      className={cn(
        "rounded-2xl border border-brand-border-subtle bg-white p-4 shadow-[0_10px_24px_-16px_rgba(7,27,51,0.25)] ",
        className,
      )}
    >
      {children}
    </Tag>
  );
}

export function SectionHeader({
  title,
  actionLabel,
  onAction,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-[15px] font-bold text-brand-navy-deep lg:text-lg">{title}</h2>
      {actionLabel ? (
        <button
          type="button"
          onClick={onAction}
          className="text-xs font-semibold text-brand-accent transition-colors hover:text-brand-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan lg:text-sm"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

export function Rating({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-secondary-text lg:text-xs">
      <Star className="h-3.5 w-3.5 fill-brand-teal text-brand-accent" />
      {value.toFixed(1)}
    </span>
  );
}

export function CartButton({ className }: { className?: string }) {
  const { count } = useCart();
  return (
    <Link
      to="/cart"
      aria-label="My Cart"
      className={cn(
        "relative block rounded-lg p-1 text-brand-navy-deep transition-colors hover:text-brand-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan ",
        className,
      )}
    >
      <ShoppingCart className="h-6 w-6" />
      <span className="absolute -end-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-brand-teal px-1 text-[9px] font-bold leading-none text-brand-navy-deep">
        {count}
      </span>
    </Link>
  );
}

export function QtyStepper({
  qty,
  onChange,
  className,
}: {
  qty: number;
  onChange: (next: number) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-3 rounded-full border border-brand-border-subtle bg-brand-surface px-2 py-1 ",
        className,
      )}
    >
      <button
        type="button"
        aria-label="Decrease quantity"
        onClick={() => onChange(qty - 1)}
        className="grid h-6 w-6 place-items-center rounded-full text-brand-navy-deep transition-colors hover:text-brand-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan "
      >
        <Minus className="h-3.5 w-3.5" />
      </button>
      <span className="min-w-4 text-center text-sm font-bold text-brand-navy-deep ">{qty}</span>
      <button
        type="button"
        aria-label="Increase quantity"
        onClick={() => onChange(qty + 1)}
        className="grid h-6 w-6 place-items-center rounded-full text-brand-navy-deep transition-colors hover:text-brand-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan "
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

/** Full-width gradient CTA used for every primary action. */
export function PrimaryButton({
  children,
  onClick,
  type = "button",
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  className?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      className={cn(
        "bg-brand-gradient flex h-13 w-full items-center justify-center gap-2 rounded-full px-6 py-4 text-sm font-bold text-white shadow-[0_16px_32px_-14px_rgba(0,160,175,0.7)] transition-transform hover:scale-[1.01] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan focus-visible:ring-offset-2 lg:text-base",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({
  children,
  onClick,
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center justify-center gap-2 rounded-full border border-brand-teal/40 bg-white px-6 py-4 text-sm font-bold text-brand-accent transition-colors hover:bg-brand-teal/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan lg:text-base ",
        className,
      )}
    >
      {children}
    </button>
  );
}

/** Sticky bottom action bar that sits just above the bottom navigation. */
export function StickyBar({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-[4.75rem] z-20 px-5 lg:bottom-[5.5rem] lg:px-10">
      <div className="w-full">{children}</div>
    </div>
  );
}

/** Compact product card reused on Home, Menu and AI suggestion sections. */
export function ProductCard({
  product,
  onOpen,
  onAdd,
}: {
  product: Product;
  onOpen?: () => void;
  onAdd?: () => void;
}) {
  return (
    <article className="flex flex-col items-center rounded-2xl border border-brand-border-subtle bg-white px-2 py-3 shadow-[0_10px_24px_-16px_rgba(7,27,51,0.25)] lg:py-4">
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full flex-col items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan"
      >
        <img
          src={product.image}
          alt={product.name}
          width={512}
          height={512}
          loading="lazy"
          className="h-16 w-16 object-contain sm:h-18 sm:w-18 lg:h-20 lg:w-20"
        />
        <h3 className="mt-2 w-full truncate text-center text-[11px] font-semibold text-brand-navy-deep lg:text-xs">
          {product.name}
        </h3>
        <div className="mt-1 flex w-full items-center justify-center gap-2">
          <span className="text-[11px] font-bold text-brand-accent lg:text-xs">
            {formatPrice(product.price)}
          </span>
          <Rating value={product.rating} />
        </div>
      </button>
      <button
        type="button"
        onClick={onAdd}
        className="bg-brand-gradient mt-2.5 flex h-7 w-full items-center justify-center gap-1 rounded-full text-[11px] font-bold text-white transition-transform hover:scale-[1.03] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan lg:h-8 lg:text-xs"
      >
        <Plus className="h-3 w-3" /> Add
      </button>
    </article>
  );
}
