"use client";
/**
 * Shared responsive data table for the Owner Portal.
 *
 * Fully presentational and generic: rows, columns, sorting, pagination and row
 * actions are all supplied by the caller, so a future API response can drive it
 * without touching this file. From `lg` it renders a real table (horizontally
 * scrollable inside its own container so the page never overflows); below `lg`
 * every row becomes a card that keeps all columns and actions.
 */
import { ArrowDown, ArrowUp, ChevronsUpDown, MoreVertical } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { SectionError } from "@/components/owner/states";
import { SkeletonBlock } from "@/components/owner/primitives";
import { TableSkeleton } from "@/components/owner/skeletons";
import { cn } from "@/lib/utils";

export type SortDirection = "asc" | "desc";
export type SortState = { columnId: string; direction: SortDirection };

export type DataTableColumn<Row> = {
  id: string;
  header: string;
  /** Cell renderer — receives the whole row. */
  cell: (row: Row) => ReactNode;
  /** Enables the sorting control on this column header. */
  sortable?: boolean;
  align?: "start" | "end";
  /** Hide this column from the mobile card layout (e.g. duplicated title). */
  hideOnCard?: boolean;
  className?: string;
};

export type RowAction<Row> = {
  id: string;
  label: string;
  onSelect: (row: Row) => void;
  icon?: ReactNode;
  tone?: "default" | "danger";
  /** Hide this action for specific rows (permission decisions stay outside). */
  hidden?: (row: Row) => boolean;
  disabled?: (row: Row) => boolean;
};

export type PaginationState = {
  page: number;
  pageSize: number;
  /** Total rows across all pages, as reported by the caller/API. */
  total: number;
  onPageChange: (page: number) => void;
};

export function DataTable<Row>({
  rows,
  columns,
  rowKey,
  isLoading = false,
  error = null,
  onRetry,
  empty,
  toolbar,
  actions,
  sort,
  onSortChange,
  pagination,
  cardTitle,
}: {
  rows: Row[];
  columns: DataTableColumn<Row>[];
  rowKey: (row: Row) => string;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: (() => void) | undefined;
  /** Empty-state node (use PresetEmpty / SectionEmpty). */
  empty?: ReactNode;
  /** Search + filter slot rendered above the table. */
  toolbar?: ReactNode;
  actions?: RowAction<Row>[];
  sort?: SortState | undefined;
  onSortChange?: ((next: SortState) => void) | undefined;
  pagination?: PaginationState | undefined;
  /** Heading rendered at the top of each mobile card. */
  cardTitle?: (row: Row) => ReactNode;
}) {
  const body = () => {
    if (isLoading) {
      return (
        <div className="p-4 sm:p-5">
          <TableSkeleton
            rows={pagination?.pageSize && pagination.pageSize < 6 ? pagination.pageSize : 5}
            columns={Math.min(columns.length, 5)}
          />
        </div>
      );
    }
    if (error) {
      return (
        <div className="p-4 sm:p-5">
          <SectionError message={error} onRetry={onRetry ?? (() => undefined)} />
        </div>
      );
    }
    if (rows.length === 0) return <div className="p-2">{empty}</div>;

    return (
      <>
        {/* Desktop / laptop: real table, scrolls inside its own container */}
        <div className="scroll-rail hidden overflow-x-auto lg:block">
          <table className="w-full">
            <thead>
              <tr className="border-b border-brand-border-subtle ">
                {columns.map((column) => (
                  <th
                    key={column.id}
                    scope="col"
                    className={cn(
                      "whitespace-nowrap px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide text-brand-muted",
                      column.align === "end" ? "text-end" : "text-start",
                      column.className,
                    )}
                  >
                    {column.sortable && onSortChange ? (
                      <SortButton
                        label={column.header}
                        active={sort?.columnId === column.id}
                        direction={sort?.columnId === column.id ? sort.direction : undefined}
                        onToggle={() =>
                          onSortChange({
                            columnId: column.id,
                            direction:
                              sort?.columnId === column.id && sort.direction === "asc"
                                ? "desc"
                                : "asc",
                          })
                        }
                      />
                    ) : (
                      column.header
                    )}
                  </th>
                ))}
                {actions?.length ? (
                  <th
                    scope="col"
                    className="px-3 py-2.5 text-end text-[11px] font-bold uppercase tracking-wide text-brand-muted"
                  >
                    Actions
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={rowKey(row)}
                  className="border-b border-brand-border-subtle transition-colors last:border-b-0 hover:bg-brand-surface-2/70 "
                >
                  {columns.map((column) => (
                    <td
                      key={column.id}
                      className={cn(
                        "px-3 py-3 text-sm text-brand-navy-deep ",
                        column.align === "end" ? "text-end" : "text-start",
                      )}
                    >
                      {column.cell(row)}
                    </td>
                  ))}
                  {actions?.length ? (
                    <td className="px-3 py-3 text-end">
                      <ActionMenu row={row} actions={actions} />
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile / tablet: cards that keep every field and action */}
        <ul className="divide-y divide-brand-border-subtle lg:hidden">
          {rows.map((row) => (
            <li key={rowKey(row)} className="px-4 py-3.5 sm:px-5">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                <div className="min-w-0 text-sm font-bold text-brand-navy-deep ">
                  {cardTitle ? cardTitle(row) : columns[0]?.cell(row)}
                </div>
                {actions?.length ? <ActionMenu row={row} actions={actions} /> : null}
              </div>
              <dl className="mt-2 grid gap-1.5 sm:grid-cols-2">
                {columns
                  .filter(
                    (column) =>
                      !column.hideOnCard && !(cardTitle === undefined && column === columns[0]),
                  )
                  .map((column) => (
                    <div
                      key={column.id}
                      className="grid grid-cols-[minmax(0,120px)_minmax(0,1fr)] gap-2"
                    >
                      <dt className="text-[11px] font-bold uppercase tracking-wide text-brand-muted">
                        {column.header}
                      </dt>
                      <dd className="min-w-0 text-sm text-brand-navy-deep ">{column.cell(row)}</dd>
                    </div>
                  ))}
              </dl>
            </li>
          ))}
        </ul>
      </>
    );
  };

  return (
    <div className="min-w-0">
      {toolbar}
      {body()}
      {pagination && !isLoading && !error && rows.length > 0 ? (
        <Pagination {...pagination} />
      ) : null}
    </div>
  );
}

function SortButton({
  label,
  active,
  direction,
  onToggle,
}: {
  label: string;
  active: boolean;
  direction?: SortDirection | undefined;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={`Sort by ${label}`}
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1 py-0.5 uppercase transition-colors hover:text-brand-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan",
        active && "text-brand-accent",
      )}
    >
      {label}
      {active && direction === "asc" ? (
        <ArrowUp className="h-3 w-3" />
      ) : active && direction === "desc" ? (
        <ArrowDown className="h-3 w-3" />
      ) : (
        <ChevronsUpDown className="h-3 w-3 opacity-60" />
      )}
    </button>
  );
}

function ActionMenu<Row>({ row, actions }: { row: Row; actions: RowAction<Row>[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const visible = actions.filter((action) => !action.hidden?.(row));

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);

  if (visible.length === 0) return null;

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Row actions"
        onClick={() => setOpen((value) => !value)}
        className="grid h-8 w-8 place-items-center rounded-lg text-brand-secondary-text transition-colors hover:bg-brand-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan "
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute end-0 z-20 mt-1 w-48 overflow-hidden rounded-xl border border-brand-border-subtle bg-white py-1 shadow-xl "
        >
          {visible.map((action) => {
            const disabled = action.disabled?.(row) ?? false;
            return (
              <button
                key={action.id}
                type="button"
                role="menuitem"
                disabled={disabled}
                onClick={() => {
                  setOpen(false);
                  action.onSelect(row);
                }}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-2 text-start text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                  action.tone === "danger"
                    ? "text-brand-danger hover:bg-destructive/10"
                    : "text-brand-navy-deep hover:bg-brand-surface-2 ",
                )}
              >
                {action.icon}
                {action.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export function Pagination({ page, pageSize, total, onPageChange }: PaginationState) {
  const pageCount = Math.max(1, Math.ceil(total / Math.max(pageSize, 1)));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="grid gap-2 border-t border-brand-border-subtle px-4 py-3 sm:flex sm:items-center sm:justify-between sm:px-5">
      <p className="text-xs text-brand-secondary-text ">
        Showing {from}–{to} of {total}
      </p>
      <div className="flex items-center gap-2">
        <PageButton label="Previous" disabled={page <= 1} onClick={() => onPageChange(page - 1)} />
        <span className="text-xs font-semibold text-brand-navy-deep ">
          Page {page} of {pageCount}
        </span>
        <PageButton
          label="Next"
          disabled={page >= pageCount}
          onClick={() => onPageChange(page + 1)}
        />
      </div>
    </div>
  );
}

function PageButton({
  label,
  disabled,
  onClick,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded-lg border border-brand-border bg-white px-2.5 py-1.5 text-xs font-semibold text-brand-navy-deep transition-colors hover:bg-brand-surface-2 disabled:cursor-not-allowed disabled:opacity-45 "
    >
      {label}
    </button>
  );
}

/** Loading placeholder for a table embedded in a narrow panel. */
export function DataTableInlineSkeleton() {
  return <SkeletonBlock className="h-40 w-full" />;
}
