"use client";

import { CollectionPage } from "@/components/owner/collection-page";
import type { DataTableColumn } from "@/components/owner/data-table";
import { SelectFilter } from "@/components/owner/filters";
import { PresetEmpty } from "@/components/owner/states";
import { StatusBadge } from "@/components/owner/status-badge";
import { VoiceAnalyticsPanel } from "@/components/owner/widgets";
import { filterValue, useOwnerCollection } from "@/lib/owner/collection";
import { dateTimeLabel, plainText } from "@/lib/owner/format";
import { useOwnerDashboard } from "@/lib/owner/hooks";
import {
  VOICE_OUTCOME_OPTIONS,
  type VoiceSessionRecord,
  fetchVoiceSessions,
} from "@/lib/owner/records";

const DESCRIPTION = "Voice ordering performance, detected intents and session transcripts.";



function OwnerVoiceAnalyticsPage() {
  const dashboard = useOwnerDashboard();
  const collection = useOwnerCollection<VoiceSessionRecord>(fetchVoiceSessions, {
    initialSort: { columnId: "startedAt", direction: "desc" },
  });

  const columns: DataTableColumn<VoiceSessionRecord>[] = [
    {
      id: "startedAt",
      header: "Started",
      sortable: true,
      hideOnCard: true,
      cell: (row) => dateTimeLabel(row.startedAt),
    },
    { id: "language", header: "Language", cell: (row) => plainText(row.language) },
    {
      id: "transcript",
      header: "Transcript",
      cell: (row) => (
        <span className="block max-w-[26rem] truncate text-brand-navy-deep ">
          {plainText(row.transcript)}
        </span>
      ),
    },
    { id: "detectedIntent", header: "Intent", cell: (row) => plainText(row.detectedIntent) },
    { id: "outcome", header: "Outcome", cell: (row) => <StatusBadge status={row.outcome} /> },
    { id: "orderReference", header: "Order", cell: (row) => plainText(row.orderReference) },
    {
      id: "durationLabel",
      header: "Duration",
      align: "end",
      cell: (row) => plainText(row.durationLabel),
    },
  ];

  return (
    <CollectionPage<VoiceSessionRecord>
      title="Voice sessions"
      description="Every voice interaction with intent and outcome."
      collection={collection}
      columns={columns}
      rowKey={(row) => row.id}
      cardTitle={(row) => dateTimeLabel(row.startedAt)}
      searchLabel="Search voice sessions"
      searchPlaceholder="Search transcripts or intents"
      empty={<PresetEmpty preset="voiceSessions" />}
      filters={
        <SelectFilter
          label="Outcome"
          value={filterValue(collection.filters, "outcome")}
          options={VOICE_OUTCOME_OPTIONS}
          onChange={(value) => collection.setFilter("outcome", value)}
          allLabel="All outcomes"
        />
      }
    >
      <VoiceAnalyticsPanel
        voice={dashboard.data?.voice ?? null}
        isLoading={dashboard.isLoading}
        error={dashboard.error}
        onRetry={dashboard.refetch}
      />
    </CollectionPage>
  );
}

export default OwnerVoiceAnalyticsPage;
