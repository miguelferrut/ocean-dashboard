// Pure helpers that turn messy spreadsheet cells into typed values.
// Ported from the legacy dashboard (legacy/Ocean_dashboardK13.html: clean, cat, parseDate, parseNum).

export type Issue = { field: string; value: string; severity: "error" | "warning"; message: string };

// Values the team types to mean "not known yet".
const PENDING = /^(TBD|N\/?A|NA|NEEDS?|PENDING|-+|#VALUE!|#N\/A|#REF!)$/i;

export const ALIASES: Record<string, Record<string, string>> = {
  currency: { CYN: "CNY", RMB: "CNY" },
  shipping_line: { "HAPAG LLOYD": "HAPAG-LLOYD" },
};

export function cleanText(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).replace(/\s+/g, " ").trim();
  return s === "" || PENDING.test(s) ? null : s;
}

export function upperText(v: unknown, field?: string): string | null {
  const s = cleanText(v);
  if (!s) return null;
  const up = s.toUpperCase();
  return (field && ALIASES[field]?.[up]) || up;
}

// Excel serial dates: 1 = 1900-01-01, valid business range roughly 1955–2119.
const EXCEL_EPOCH = Date.UTC(1899, 11, 30);
const DAY = 86_400_000;

function iso(y: number, m: number, d: number): string | null {
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return dt.toISOString().slice(0, 10);
}

/** Returns an ISO date (YYYY-MM-DD) or null. Unparseable non-blank values are reported. */
export function parseDate(v: unknown, field: string, issues: Issue[]): string | null {
  if (v == null || v === "") return null;
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return null;
    return iso(v.getUTCFullYear(), v.getUTCMonth() + 1, v.getUTCDate());
  }
  if (typeof v === "number") {
    if (v > 20000 && v < 80000) return new Date(EXCEL_EPOCH + Math.round(v) * DAY).toISOString().slice(0, 10);
    issues.push({ field, value: String(v), severity: "warning", message: "Number is not a valid date" });
    return null;
  }
  const s = String(v).trim();
  if (s === "" || PENDING.test(s)) return null;
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    const r = iso(+m[1], +m[2], +m[3]);
    if (r) return r;
  }
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    // Ambiguous d/m vs m/d: prefer day-first (Mexico) unless the first part cannot be a day-month pair.
    const a = +m[1];
    const b = +m[2];
    const [d, mo] = a > 12 && b <= 12 ? [a, b] : b > 12 && a <= 12 ? [b, a] : [a, b];
    const r = iso(+m[3], mo, d);
    if (r) return r;
  }
  issues.push({ field, value: s, severity: "warning", message: "Not a recognisable date; left empty" });
  return null;
}

export function parseNumber(v: unknown, field: string, issues: Issue[]): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const raw = String(v).trim();
  if (PENDING.test(raw)) return null;
  const s = raw.replace(/[, ]/g, "").replace(/[A-Za-z]+$/, "");
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  issues.push({ field, value: raw, severity: "warning", message: "Not a number; left empty" });
  return null;
}

const YES = /^(1|1\.0+|true|yes|y|si|sí|verdadero|x)$/i;
const NO = /^(0|false|no|n|falso)$/i;

/** true / false / null (unknown). */
export function parseBool(v: unknown): boolean | null {
  if (v == null || v === "") return null;
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v > 0;
  const s = String(v).trim();
  if (YES.test(s)) return true;
  if (NO.test(s)) return false;
  return null;
}

/** Identifier columns (invoice, BL, container): upper-case, no inner whitespace. Numbers become text. */
export function parseId(v: unknown): string | null {
  if (v == null) return null;
  const s = (typeof v === "number" ? String(Math.trunc(v)) : String(v)).replace(/\s+/g, "").toUpperCase();
  return s === "" || PENDING.test(s) ? null : s;
}
