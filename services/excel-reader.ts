import "server-only";
import { Readable } from "node:stream";
import ExcelJS from "exceljs";

export type SheetGrid = { header: unknown[]; data: unknown[][]; headerRowNumber: number };

// Unwraps ExcelJS cell values (formula results, rich text, hyperlinks, errors) into plain values.
function plain(v: ExcelJS.CellValue): unknown {
  if (v == null) return null;
  if (v instanceof Date || typeof v !== "object") return v;
  if ("result" in v) return plain((v as ExcelJS.CellFormulaValue).result as ExcelJS.CellValue);
  if ("sharedFormula" in v) return plain((v as ExcelJS.CellSharedFormulaValue).result as ExcelJS.CellValue);
  if ("richText" in v) return (v as ExcelJS.CellRichTextValue).richText.map((t) => t.text).join("");
  if ("text" in v) return (v as ExcelJS.CellHyperlinkValue).text;
  if ("error" in v) return (v as ExcelJS.CellErrorValue).error;
  return null;
}

const isHeaderCell = (c: unknown) => String(c ?? "").replace(/[^a-z]/gi, "").toLowerCase() === "invoiceno";

/**
 * Streams one worksheet into a header row + data rows. Other sheets are skipped without being
 * materialised, which keeps memory and time low on large workbooks (the master file has
 * 10k+ formatted rows and a 3.5k-row packing list).
 * The header is the first row within the first 10 that contains an "Invoice_No" cell.
 */
export async function readSheet(buffer: ArrayBuffer, sheetName: string): Promise<SheetGrid> {
  const reader = new ExcelJS.stream.xlsx.WorkbookReader(Readable.from(Buffer.from(buffer)), {
    sharedStrings: "cache",
    styles: "cache", // needed to recognise date-formatted cells
    hyperlinks: "ignore",
    worksheets: "emit",
    entries: "ignore",
  });

  const seen: string[] = [];
  const target = sheetName.trim().toLowerCase();

  for await (const ws of reader) {
    const sheet = ws as unknown as ExcelJS.Worksheet & AsyncIterable<ExcelJS.Row>;
    const name = (sheet as unknown as { name: string }).name ?? "";
    seen.push(name);
    if (name.trim().toLowerCase() !== target) {
      for await (const _ of sheet) void _; // drain
      continue;
    }

    let header: unknown[] | null = null;
    let headerRowNumber = 0;
    const data: unknown[][] = [];
    for await (const row of sheet) {
      const values = (row.values as ExcelJS.CellValue[]).slice(1).map(plain); // values is 1-based
      if (!header) {
        if (row.number > 10) break;
        if (values.some(isHeaderCell)) {
          header = values;
          headerRowNumber = row.number;
        }
        continue;
      }
      // Keep spreadsheet row numbers aligned so issues cite the real Excel row.
      data[row.number - headerRowNumber - 1] = values;
    }
    if (!header) throw new Error(`No header row with "Invoice_No" found in the first 10 rows of "${sheetName}"`);
    return { header, data: Array.from(data, (r) => r ?? []), headerRowNumber };
  }

  throw new Error(`Sheet "${sheetName}" not found. Sheets in this file: ${seen.join(", ") || "none"}`);
}
