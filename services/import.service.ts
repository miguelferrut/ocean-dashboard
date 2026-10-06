import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SHEET_NAME } from "@/domain/excel-columns";
import { parseShipmentGrid } from "@/domain/shipment-rows";
import { readSheet } from "@/services/excel-reader";
import type { Database } from "@/types/database.types";

export type ImportSummary = {
  batchId: string;
  totalRows: number;
  imported: number;
  rejected: number;
  warnings: number;
  unknownHeaders: string[];
};

const CHUNK = 500;

/**
 * Imports an uploaded workbook (already in the private `imports` bucket) into `shipments`.
 * Runs with the caller's client, so RLS decides whether they may upload and write.
 *
 * Rows are upserted by invoice_no: existing invoices are updated, new ones inserted, and invoices
 * that are missing from the file are left untouched (an import never deletes data).
 */
export async function importWorkbook(
  supabase: SupabaseClient<Database>,
  userId: string,
  storagePath: string,
  fileName: string,
): Promise<ImportSummary> {
  const { data: batch, error: batchError } = await supabase
    .from("import_batches")
    .insert({ file_name: fileName, sheet_name: SHEET_NAME, uploaded_by: userId })
    .select("id")
    .single();
  if (batchError || !batch) throw new Error(`Could not start the import: ${batchError?.message}`);
  const batchId = batch.id;

  const fail = async (message: string) => {
    await supabase
      .from("import_batches")
      .update({ status: "failed", finished_at: new Date().toISOString() })
      .eq("id", batchId);
    await supabase
      .from("import_issues")
      .insert({ batch_id: batchId, row_number: 0, severity: "error", message, invoice_no: null, field: null, value: null });
    return new Error(message);
  };

  const { data: file, error: dlError } = await supabase.storage.from("imports").download(storagePath);
  if (dlError || !file) throw await fail(`Could not read the uploaded file: ${dlError?.message ?? "not found"}`);

  let parsed;
  try {
    const grid = await readSheet(await file.arrayBuffer(), SHEET_NAME);
    parsed = parseShipmentGrid(grid.header, grid.data, grid.headerRowNumber);
  } catch (e) {
    throw await fail(e instanceof Error ? e.message : "The file could not be read as an Excel workbook");
  }

  let imported = 0;
  for (let i = 0; i < parsed.rows.length; i += CHUNK) {
    const chunk = parsed.rows
      .slice(i, i + CHUNK)
      .map((r) => ({ ...r, last_import_id: batchId, updated_by: userId }));
    const { error } = await supabase.from("shipments").upsert(chunk, { onConflict: "invoice_no" });
    if (error) {
      throw await fail(`Saving rows ${i + 1}–${i + chunk.length} failed: ${error.message}. Rows before this were saved.`);
    }
    imported += chunk.length;
  }

  if (parsed.issues.length) {
    const issues = parsed.issues.map((x) => ({
      batch_id: batchId,
      row_number: x.rowNumber,
      invoice_no: x.invoiceNo,
      field: x.field,
      value: x.value.slice(0, 500),
      severity: x.severity,
      message: x.message,
    }));
    for (let i = 0; i < issues.length; i += CHUNK) {
      await supabase.from("import_issues").insert(issues.slice(i, i + CHUNK));
    }
  }

  await supabase
    .from("import_batches")
    .update({
      status: "completed",
      rows_total: parsed.totalRows,
      rows_imported: imported,
      rows_rejected: parsed.rejectedRows,
      finished_at: new Date().toISOString(),
    })
    .eq("id", batchId);

  return {
    batchId,
    totalRows: parsed.totalRows,
    imported,
    rejected: parsed.rejectedRows,
    warnings: parsed.issues.filter((x) => x.severity === "warning").length,
    unknownHeaders: parsed.unknownHeaders,
  };
}
