"use client";
/**
 * Reusable list-screen shell for the Owner Portal.
 *
 * Composes the existing Panel + FilterBar + DataTable + Pagination primitives so
 * every module screen (orders, products, inventory, suppliers, POs, khata,
 * riders…) is declarative: pass columns, filters and a collection driver.
 */
import type { ReactNode } from "react";
import { DataTable, type DataTableColumn, type RowAction } from "@/components/owner/data-table";
import { FilterBar } from "@/components/owner/filters";
import { Panel, PanelHeader } from "@/components/owner/primitives";
import { EntitySearch } from "@/components/owner/search-input";
import { InlineLoading } from "@/components/owner/spinner";
import type { OwnerCollection } from "@/lib/owner/collection";

export function CollectionPage<Row>({
  title,
  description,
  collection,
  columns,
  rowKey,
  cardTitle,
  actions,
  searchLabel,
  searchPlaceholder,
  filters,
  empty,
  headerAction,
  children,
}: {
  title: string;
  description: string;
  collection: OwnerCollection<Row>;
  columns: DataTableColumn<Row>[];
  rowKey: (row: Row) => string;
  cardTitle?: ((row: Row) => ReactNode) | undefined;
  actions?: RowAction<Row>[] | undefined;
  searchLabel: string;
  searchPlaceholder?: string | undefined;
  /** Filter controls rendered inside the toolbar. */
  filters?: ReactNode;
  empty: ReactNode;
  /** Primary action rendered in the panel header (e.g. "Add product"). */
  headerAction?: ReactNode;
  /** Optional content rendered above the table panel (KPIs, charts…). */
  children?: ReactNode;
}) {
  return (
    <div className="space-y-4 sm:space-y-5">
      {children}
      <Panel>
        <PanelHeader title={title} description={description}>
          {collection.isRefreshing ? <InlineLoading label="Updating" /> : null}
          {headerAction}
        </PanelHeader>
        <DataTable<Row>
          rows={collection.rows}
          columns={columns}
          rowKey={rowKey}
          {...(cardTitle ? { cardTitle } : {})}
          isLoading={collection.isLoading}
          error={collection.error}
          onRetry={collection.refetch}
          empty={empty}
          {...(actions ? { actions } : {})}
          sort={collection.sort}
          onSortChange={collection.setSort}
          pagination={{
            page: collection.page,
            pageSize: collection.pageSize,
            total: collection.total,
            onPageChange: collection.setPage,
          }}
          toolbar={
            <FilterBar
              search={
                <EntitySearch
                  value={collection.search}
                  onChange={collection.setSearch}
                  label={searchLabel}
                  placeholder={searchPlaceholder}
                />
              }
              onReset={collection.resetFilters}
              activeCount={collection.activeFilterCount}
            >
              {filters}
            </FilterBar>
          }
        />
      </Panel>
    </div>
  );
}
