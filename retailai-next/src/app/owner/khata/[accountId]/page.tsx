"use client";

import { Link, useParams } from "@/lib/router-compat";import { ArrowLeft, Wallet } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { OwnerButton } from "@/components/owner/confirm-dialog";
import { DataTable, type DataTableColumn } from "@/components/owner/data-table";
import { FilterBar, SelectFilter } from "@/components/owner/filters";
import {
  ErrorState,
  Panel,
  PanelBody,
  PanelHeader,
  SkeletonBlock,
} from "@/components/owner/primitives";
import { EntitySearch } from "@/components/owner/search-input";
import { InlineLoading } from "@/components/owner/spinner";
import { SectionEmpty } from "@/components/owner/states";
import { StatusBadge } from "@/components/owner/status-badge";
import { RecordPaymentDialog } from "@/components/owner/workflow-dialogs";
import { useAccess } from "@/lib/owner/access";
import { filterValue, useOwnerCollection } from "@/lib/owner/collection";
import { dateLabel, formatRelativeTime, plainText } from "@/lib/owner/format";
import {
  KHATA_ENTRY_TYPE_OPTIONS,
  type KhataDetail,
  type KhataEntry,
  fetchKhataDetail,
  fetchKhataEntries,
  recordKhataPayment,
} from "@/lib/owner/records";

const DESCRIPTION = "Full ledger for a single supplier: purchases, payments and running balance.";



function SummaryTile({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-brand-surface-2 p-3.5 ">
      <p className="text-[11px] font-bold uppercase tracking-wide text-brand-muted">{label}</p>
      <p className="mt-1 truncate text-base font-black text-brand-navy-deep ">{value}</p>
    </div>
  );
}

function KhataDetailPage() {
  const { accountId } = useParams({ from: "/owner/khata/$accountId" });
  const { can } = useAccess();

  const [detail, setDetail] = useState<KhataDetail | null>(null);
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchKhataDetail(accountId)
      .then((result) => {
        if (!cancelled) setDetail(result);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Request failed");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [accountId, nonce]);

  const entriesFetcher = useCallback(
    (query: Parameters<typeof fetchKhataEntries>[0]) =>
      fetchKhataEntries({ ...query, filters: { ...query.filters, accountId } }),
    [accountId],
  );

  const entries = useOwnerCollection<KhataEntry>(entriesFetcher, {
    initialSort: { columnId: "occurredAt", direction: "desc" },
  });

  const columns: DataTableColumn<KhataEntry>[] = [
    {
      id: "occurredAt",
      header: "Date",
      sortable: true,
      hideOnCard: true,
      cell: (row) => dateLabel(row.occurredAt),
    },
    {
      id: "type",
      header: "Type",
      cell: (row) => <StatusBadge status={row.type} label={typeLabel(row.type)} tone="info" />,
    },
    { id: "reference", header: "Reference", cell: (row) => plainText(row.reference) },
    { id: "debit", header: "Debit", align: "end", cell: (row) => plainText(row.debit) },
    { id: "credit", header: "Credit", align: "end", cell: (row) => plainText(row.credit) },
    {
      id: "balance",
      header: "Balance",
      align: "end",
      cell: (row) => (
        <span className="font-bold text-brand-navy-deep ">{plainText(row.balance)}</span>
      ),
    },
    { id: "note", header: "Note", cell: (row) => plainText(row.note) },
  ];

  return (
    <div className="space-y-4 sm:space-y-5">
      <Link
        to="/owner/khata"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-accent transition-opacity hover:opacity-80"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Supplier Khata
      </Link>

      <Panel>
        <PanelHeader title={detail?.supplierName ?? "Supplier ledger"} description={DESCRIPTION}>
          {detail?.status ? <StatusBadge status={detail.status} /> : null}
          {can("supplier-khata", "record-payment") ? (
            <OwnerButton className="px-3 py-2 text-xs" onClick={() => setPaying(true)}>
              <Wallet className="h-4 w-4" />
              Record payment
            </OwnerButton>
          ) : null}
        </PanelHeader>
        <PanelBody>
          {isLoading ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <SkeletonBlock key={index} className="h-20 rounded-2xl" />
              ))}
            </div>
          ) : error ? (
            <ErrorState message={error} onRetry={() => setNonce((value) => value + 1)} />
          ) : detail ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <SummaryTile label="Outstanding" value={plainText(detail.outstanding)} />
              <SummaryTile label="Credit limit" value={plainText(detail.creditLimit)} />
              <SummaryTile label="Payment terms" value={plainText(detail.paymentTerms)} />
              <SummaryTile label="Last payment" value={formatRelativeTime(detail.lastPaymentAt)} />
            </div>
          ) : (
            <SectionEmpty
              title="Ledger not available"
              description="This supplier account has no ledger data yet."
            />
          )}
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader title="Ledger entries" description="Every purchase, payment and adjustment.">
          {entries.isRefreshing ? <InlineLoading label="Updating" /> : null}
        </PanelHeader>
        <DataTable<KhataEntry>
          rows={entries.rows}
          columns={columns}
          rowKey={(row) => row.id}
          cardTitle={(row) => dateLabel(row.occurredAt)}
          isLoading={entries.isLoading}
          error={entries.error}
          onRetry={entries.refetch}
          empty={
            <SectionEmpty
              title="No ledger entries"
              description="Purchases and payments for this supplier will appear here."
            />
          }
          sort={entries.sort}
          onSortChange={entries.setSort}
          pagination={{
            page: entries.page,
            pageSize: entries.pageSize,
            total: entries.total,
            onPageChange: entries.setPage,
          }}
          toolbar={
            <FilterBar
              search={
                <EntitySearch
                  value={entries.search}
                  onChange={entries.setSearch}
                  label="Search ledger entries"
                  placeholder="Search by reference or note"
                />
              }
              onReset={entries.resetFilters}
              activeCount={entries.activeFilterCount}
            >
              <SelectFilter
                label="Entry type"
                value={filterValue(entries.filters, "type")}
                options={KHATA_ENTRY_TYPE_OPTIONS}
                onChange={(value) => entries.setFilter("type", value)}
                allLabel="All types"
              />
            </FilterBar>
          }
        />
      </Panel>

      <RecordPaymentDialog
        open={paying}
        account={
          detail
            ? {
                id: detail.id,
                supplierName: detail.supplierName,
                outstanding: detail.outstanding,
              }
            : { id: accountId, supplierName: "this supplier", outstanding: "—" }
        }
        onClose={() => setPaying(false)}
        onConfirm={async (input) => {
          await recordKhataPayment(input);
          setNonce((value) => value + 1);
          entries.refetch();
        }}
      />
    </div>
  );
}

function typeLabel(type: string): string {
  return KHATA_ENTRY_TYPE_OPTIONS.find((option) => option.value === type)?.label ?? type;
}

export default KhataDetailPage;
