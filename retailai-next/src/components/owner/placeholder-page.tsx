"use client";
import { Panel, PanelBody, PanelHeader, EmptyState } from "@/components/owner/primitives";

/** Shared shell for owner sections whose data layer is not wired yet. */
export function OwnerPlaceholderPage({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <Panel>
      <PanelHeader title={title} description={description} />
      <PanelBody>
        <EmptyState
          title="No data yet"
          description="This screen is ready to consume API data — records will appear here once connected."
        />
      </PanelBody>
    </Panel>
  );
}
