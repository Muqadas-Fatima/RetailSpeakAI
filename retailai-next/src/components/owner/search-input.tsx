"use client";
/**
 * Reusable search inputs for the Owner Portal.
 * `EntitySearch` is the presentational primitive; each entity exports its own
 * thin wrapper so pages never share one global search across unrelated data.
 * Searching updates frontend state only — the value is always owned by the page.
 */
import { Search } from "lucide-react";
import { useId } from "react";
import { cn } from "@/lib/utils";

export function EntitySearch({
  value,
  onChange,
  label,
  placeholder,
  className,
  autoFocus,
}: {
  value: string;
  onChange: (value: string) => void;
  /** Accessible label, e.g. "Search orders". */
  label: string;
  placeholder?: string | undefined;
  className?: string | undefined;
  autoFocus?: boolean | undefined;
}) {
  const id = useId();
  return (
    <div className={cn("relative w-full min-w-0", className)}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 start-3 my-auto h-4 w-4 text-brand-muted"
      />
      <input
        id={id}
        type="search"
        value={value}
        autoFocus={autoFocus}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder ?? label}
        className="h-10 w-full rounded-xl border border-brand-border bg-white ps-9 pe-3 text-sm text-brand-navy-deep placeholder:text-brand-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan "
      />
    </div>
  );
}

type EntitySearchProps = {
  value: string;
  onChange: (value: string) => void;
  className?: string | undefined;
};

export const OrdersSearch = (props: EntitySearchProps) => (
  <EntitySearch {...props} label="Search orders" placeholder="Search by order ID or customer" />
);

export const ProductsSearch = (props: EntitySearchProps) => (
  <EntitySearch {...props} label="Search products" placeholder="Search by product or SKU" />
);

export const InventorySearch = (props: EntitySearchProps) => (
  <EntitySearch {...props} label="Search inventory" placeholder="Search stock items" />
);

export const SuppliersSearch = (props: EntitySearchProps) => (
  <EntitySearch {...props} label="Search suppliers" placeholder="Search by supplier name" />
);

export const PurchaseOrdersSearch = (props: EntitySearchProps) => (
  <EntitySearch {...props} label="Search purchase orders" placeholder="Search by PO number" />
);

export const UsersSearch = (props: EntitySearchProps) => (
  <EntitySearch {...props} label="Search users" placeholder="Search by name, email or phone" />
);
