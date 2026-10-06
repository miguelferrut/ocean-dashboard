// Dates are stored as YYYY-MM-DD and shown in a fixed, locale-independent format (06-Jun-2026),
// matching the legacy dashboard and avoiding day/month ambiguity between MX and US readers.
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  const [y, m, day] = d.slice(0, 10).split("-");
  return `${day}-${MONTHS[Number(m) - 1]}-${y}`;
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${fmtDate(d.toISOString().slice(0, 10))} ${d.toISOString().slice(11, 16)} UTC`;
}

export function fmtNumber(n: number | null | undefined, digits = 0): string {
  if (n == null) return "—";
  return n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function fmtMoney(n: number | null | undefined, currency: string | null | undefined): string {
  if (n == null) return "—";
  return `${fmtNumber(n, 2)} ${currency ?? ""}`.trim();
}

/** Today in the business time zone (Mexico City), as YYYY-MM-DD. */
export function todayISO(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City" }).format(new Date());
}
