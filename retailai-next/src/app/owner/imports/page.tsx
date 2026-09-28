"use client";

import { CloudUpload } from "lucide-react";
import { OwnerButton } from "@/components/owner/confirm-dialog";
import {
  FileDropzone,
  ImportResult,
  StagedFileCard,
  TemplateHint,
  UploadProgress,
  validateCsvFile,
} from "@/components/owner/csv-upload";
import { DataTable, type DataTableColumn } from "@/components/owner/data-table";
import { Panel, PanelBody, PanelHeader } from "@/components/owner/primitives";
import { FilterOptionSelect } from "@/components/owner/select-field";
import { PresetEmpty } from "@/components/owner/states";
import { StatusBadge } from "@/components/owner/status-badge";
import { importEntityLabel, useCsvImport } from "@/lib/owner/imports";
import { useOwnerCollection } from "@/lib/owner/collection";
import { dateTimeLabel, plainText } from "@/lib/owner/format";
import { IMPORT_ENTITY_OPTIONS, type ImportBatch, fetchImportBatches } from "@/lib/owner/records";

const DESCRIPTION = "Bulk-upload products, inventory, suppliers and purchase orders from CSV.";



function OwnerImportsPage() {
  const importer = useCsvImport(IMPORT_ENTITY_OPTIONS[0]?.value ?? "products");
  const history = useOwnerCollection<ImportBatch>(fetchImportBatches, {
    initialSort: { columnId: "uploadedAt", direction: "desc" },
    pageSize: 5,
  });

  const entityLabel = importEntityLabel(importer.entity);
  const uploading = importer.phase === "uploading";

  const columns: DataTableColumn<ImportBatch>[] = [
    {
      id: "fileName",
      header: "File",
      hideOnCard: true,
      cell: (row) => (
        <span className="block truncate font-bold text-brand-navy-deep ">{row.fileName}</span>
      ),
    },
    { id: "entity", header: "Target", cell: (row) => importEntityLabel(row.entity) },
    {
      id: "uploadedAt",
      header: "Uploaded",
      sortable: true,
      cell: (row) => dateTimeLabel(row.uploadedAt),
    },
    { id: "rowCount", header: "Rows", align: "end", cell: (row) => row.rowCount },
    { id: "status", header: "Status", cell: (row) => <StatusBadge status={row.status} /> },
  ];

  return (
    <div className="space-y-4 sm:space-y-5">
      <Panel>
        <PanelHeader title="Data imports" description={DESCRIPTION} />
        <PanelBody className="space-y-4">
          <FilterOptionSelect
            id="import-entity"
            label="What are you importing?"
            value={importer.entity}
            options={IMPORT_ENTITY_OPTIONS}
            onChange={(value) => {
              importer.reset();
              importer.setEntity(value);
            }}
          />

          {importer.file ? (
            <StagedFileCard
              file={importer.file}
              error={importer.fileError}
              onRemove={importer.reset}
            />
          ) : (
            <FileDropzone
              disabled={uploading}
              onSelect={(file) => {
                importer.setFile(file);
                importer.setFileError(validateCsvFile(file));
              }}
            />
          )}

          {uploading ? (
            <UploadProgress value={importer.progress} label={`Uploading ${entityLabel} CSV`} />
          ) : null}

          {importer.phase === "success" && importer.message ? (
            <ImportResult
              tone="success"
              title="Upload complete"
              message={importer.message}
              onDismiss={importer.reset}
            />
          ) : null}

          {importer.phase === "error" && importer.message ? (
            <ImportResult
              tone="error"
              title="Upload failed"
              message={importer.message}
              onRetry={() => void importer.start()}
              onDismiss={importer.reset}
            />
          ) : null}

          <div className="flex flex-wrap gap-2">
            <OwnerButton
              onClick={() => void importer.start()}
              disabled={!importer.file || Boolean(importer.fileError) || uploading}
              loading={uploading}
            >
              <CloudUpload className="h-4 w-4" />
              Start import
            </OwnerButton>
            {importer.file ? (
              <OwnerButton variant="secondary" onClick={importer.reset} disabled={uploading}>
                Clear
              </OwnerButton>
            ) : null}
          </div>

          <TemplateHint columns={importer.templateColumns} entityLabel={entityLabel} />
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader title="Import history" description="Recent uploads and their results." />
        <DataTable<ImportBatch>
          rows={history.rows}
          columns={columns}
          rowKey={(row) => row.id}
          cardTitle={(row) => row.fileName}
          isLoading={history.isLoading}
          error={history.error}
          onRetry={history.refetch}
          empty={<PresetEmpty preset="imports" />}
          sort={history.sort}
          onSortChange={history.setSort}
          pagination={{
            page: history.page,
            pageSize: history.pageSize,
            total: history.total,
            onPageChange: history.setPage,
          }}
        />
      </Panel>
    </div>
  );
}

export default OwnerImportsPage;
