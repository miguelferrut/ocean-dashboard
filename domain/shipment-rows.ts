import { classifyInvoice } from "@/domain/invoice-type";
import { REQUIRED_HEADERS, resolveHeader } from "@/domain/excel-columns";
import {
  cleanText,
  parseBool,
  parseDate,
  parseId,
  parseNumber,
  upperText,
  type Issue,
} from "@/domain/normalize";
import type { ShipmentInsert } from "@/types/database.types";

export type RowIssue = Issue & { rowNumber: number; invoiceNo: string | null };

export type ParseResult = {
  rows: ShipmentInsert[];
  issues: RowIssue[];
  /** Data rows that had at least one identifier (blank rows are not counted). */
  totalRows: number;
  rejectedRows: number;
  unknownHeaders: string[];
};

const CURRENCIES = new Set(["CNY", "USD"]);
const MODULATION = new Set(["GREEN", "RED"]);

/**
 * Converts the raw cell grid of Ocean_Traffic_Report into shipment records.
 * `headerRowNumber` is the 1-based spreadsheet row of the header, so issues cite real Excel rows.
 *
 * Duplicate invoice numbers are data errors (business decision 2026-10-06): every row that
 * shares an invoice number is rejected, and the existing database record is left unchanged.
 */
export function parseShipmentGrid(header: unknown[], data: unknown[][], headerRowNumber = 1): ParseResult {
  const cols = header.map((h) => resolveHeader(h));
  const unknownHeaders = header
    .map((h, i) => (cols[i] || h == null || String(h).trim() === "" ? null : String(h).replace(/\s+/g, " ").trim()))
    .filter((h): h is string => h !== null);

  const present = new Set(cols.filter(Boolean).map((c) => c!.header));
  const missing = REQUIRED_HEADERS.filter((h) => !present.has(h));
  if (missing.length) {
    throw new Error(`The sheet is missing required column(s): ${missing.join(", ")}`);
  }

  const issues: RowIssue[] = [];
  const candidates: { rowNumber: number; row: ShipmentInsert }[] = [];
  let totalRows = 0;
  let rejectedRows = 0;

  data.forEach((cells, i) => {
    const rowNumber = headerRowNumber + 1 + i;
    const rowIssues: Issue[] = [];
    const rec: Record<string, unknown> = {};
    let aaaReadyRaw: unknown = null;
    let criticalRaw: unknown = null;

    cols.forEach((spec, c) => {
      if (!spec) return;
      const v = cells[c];
      switch (spec.column) {
        case "aaa_ready_raw":
          aaaReadyRaw = v;
          // Holds either a ready date or a flag like "NEEDS" / "N/A"; only dates are stored.
          rec.aaa_ready_date =
            v instanceof Date || typeof v === "number" || (typeof v === "string" && /^\d/.test(v.trim()))
              ? parseDate(v, spec.header, rowIssues)
              : null;
          return;
        case "critical_raw":
          criticalRaw = v;
          return;
      }
      switch (spec.kind) {
        case "id":
          rec[spec.column] = parseId(v);
          break;
        case "text":
          rec[spec.column] = cleanText(v);
          break;
        case "upper":
          rec[spec.column] = upperText(v, spec.column);
          break;
        case "date":
          rec[spec.column] = parseDate(v, spec.header, rowIssues);
          break;
        case "number":
          rec[spec.column] = parseNumber(v, spec.header, rowIssues);
          break;
        case "integer": {
          const n = parseNumber(v, spec.header, rowIssues);
          rec[spec.column] = n == null ? null : Math.round(n);
          break;
        }
        case "bool":
          rec[spec.column] = parseBool(v);
          break;
      }
    });

    const invoiceNo = (rec.invoice_no as string | null) ?? null;
    const hasAnyId = invoiceNo || rec.bl_no || rec.container_no;
    if (!hasAnyId) return; // blank or helper row
    totalRows++;

    const push = (list: Issue[]) => list.forEach((x) => issues.push({ ...x, rowNumber, invoiceNo }));

    if (!invoiceNo) {
      rejectedRows++;
      push([{ field: "Invoice_No", value: "", severity: "error", message: "Row has no invoice number; skipped" }]);
      return;
    }

    // Field-level validation that maps to database CHECK constraints.
    if (rec.currency != null && !CURRENCIES.has(rec.currency as string)) {
      rowIssues.push({ field: "Currency", value: String(rec.currency), severity: "warning", message: "Unknown currency; left empty" });
      rec.currency = null;
    }
    if (rec.modulation_status != null && !MODULATION.has(rec.modulation_status as string)) {
      rowIssues.push({ field: "Modulation_Status", value: String(rec.modulation_status), severity: "warning", message: "Expected GREEN or RED; left empty" });
      rec.modulation_status = null;
    }
    for (const f of ["invoice_total_value", "weight_kg", "pallets"] as const) {
      if (typeof rec[f] === "number" && (rec[f] as number) < 0) {
        rowIssues.push({ field: f, value: String(rec[f]), severity: "warning", message: "Negative value; left empty" });
        rec[f] = null;
      }
    }

    const critical = cleanText(criticalRaw)?.toUpperCase() ?? null;
    rec.is_critical = critical == null ? null : critical.startsWith("YES") ? true : critical.startsWith("NO") ? false : null;
    rec.needs_aaa = rec.needs_aaa === true;
    rec.invoice_type = classifyInvoice({
      invoiceNo,
      needsAaa: rec.needs_aaa as boolean,
      aaaReadyRaw,
      materialType: (rec.material_type as string | null) ?? null,
    });

    push(rowIssues);
    candidates.push({ rowNumber, row: rec as ShipmentInsert });
  });

  // Reject every row whose invoice number appears more than once in the file.
  const seen = new Map<string, number[]>();
  candidates.forEach(({ rowNumber, row }) => {
    seen.set(row.invoice_no, [...(seen.get(row.invoice_no) ?? []), rowNumber]);
  });
  const rows: ShipmentInsert[] = [];
  candidates.forEach(({ rowNumber, row }) => {
    const dupRows = seen.get(row.invoice_no)!;
    if (dupRows.length > 1) {
      rejectedRows++;
      issues.push({
        rowNumber,
        invoiceNo: row.invoice_no,
        field: "Invoice_No",
        value: row.invoice_no,
        severity: "error",
        message: `Duplicate invoice number (rows ${dupRows.join(", ")}); not imported — fix in Excel and re-upload`,
      });
    } else {
      rows.push(row);
    }
  });

  return { rows, issues, totalRows, rejectedRows, unknownHeaders };
}
