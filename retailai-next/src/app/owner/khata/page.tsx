"use client";

import { useNavigate } from "@/lib/router-compat";import { Wallet } from "lucide-react";
import { useState } from "react";
import { CollectionPage } from "@/components/owner/collection-page";
import type { DataTableColumn, RowAction } from "@/components/owner/data-table";
import { SelectFilter } from "@/components/owner/filters";
import { PresetEmpty } from "@/components/owner/states";
import { StatusBadge } from "@/components/owner/status-badge";
import { RecordPaymentDialog } from "@/components/owner/workflow-dialogs";
import { useAccess } from "@/lib/owner/access";
import { filterValue, useOwnerCollection } from "@/lib/owner/collection";
import { dateLabel, formatRelativeTime, plainText } from "@/lib/owner/format";
import {
  KHATA_STATUS_OPTIONS,
  type KhataAccount,
  fetchKhataAccounts,
  recordKhataPayment,
} from "@/lib/owner/records";

const DESCRIPTION = "Supplier ledger balances, due dates and recorded payments.";



function OwnerKhataPage() {
  const { can } = useAccess();
  const navigate = useNavigate();
  const collection = useOwnerCollection<KhataAccount>(fetchKhataAccounts, {
    initialSort: { columnId: "outstanding", direction: "desc" },
  });
  const [paying, setPaying] = useState<KhataAccount | null>(null);

  const columns: DataTableColumn<KhataAccount>[] = [
    {
      id: "supplierName",
      header: "Supplier",
      sortable: true,
      hideOnCard: true,
      cell: (row) => <span className="font-bold text-brand-navy-deep ">{row.supplierName}</span>,
    },
    {
      id: "outstanding",
      header: "Outstanding",
      sortable: true,
      align: "end",
      cell: (row) => (
        <span className="font-bold text-brand-navy-deep ">{plainText(row.outstanding)}</span>
      ),
    },
    { id: "dueAt", header: "Due", cell: (row) => dateLabel(row.dueAt) },
    {
      id: "lastPaymentAt",
      header: "Last payment",
      cell: (row) => formatRelativeTime(row.lastPaymentAt),
    },
    { id: "status", header: "Status", cell: (row) => <StatusBadge status={row.status} /> },
  ];

  const actions: RowAction<KhataAccount>[] = [
    {
      id: "open",
      label: "View ledger",
      onSelect: (row) =>
        void navigate({ to: "/owner/khata/$accountId", params: { accountId: row.id } }),
    },
    {
      id: "pay",
      label: "Record payment",
      icon: <Wallet className="h-4 w-4" />,
      onSelect: (row) => setPaying(row),
      hidden: () => !can("supplier-khata", "record-payment"),
    },
  ];

  return (
    <>
      <CollectionPage<KhataAccount>
        title="Supplier Khata"
        description={DESCRIPTION}
        collection={collection}
        columns={columns}
        rowKey={(row) => row.id}
        cardTitle={(row) => row.supplierName}
        actions={actions}
        searchLabel="Search ledger accounts"
        searchPlaceholder="Search by supplier"
        empty={<PresetEmpty preset="khata" />}
        filters={
          <SelectFilter
            label="Status"
            value={filterValue(collection.filters, "status")}
            options={KHATA_STATUS_OPTIONS}
            onChange={(value) => collection.setFilter("status", value)}
            allLabel="All accounts"
          />
        }
      />

      <RecordPaymentDialog
        open={paying !== null}
        account={
          paying
            ? { id: paying.id, supplierName: paying.supplierName, outstanding: paying.outstanding }
            : null
        }
        onClose={() => setPaying(null)}
        onConfirm={async (input) => {
          await recordKhataPayment(input);
          collection.refetch();
        }}
      />
    </>
  );
}

export default OwnerKhataPage;
