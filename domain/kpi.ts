import { isDelivered, rollUpStatus, STATUS_ORDER } from "@/domain/status";
import type { ShipmentStatus, ShipmentViewRow } from "@/types/database.types";

// Columns the dashboard needs; keep the select list and this type in sync.
export const KPI_COLUMNS =
  "invoice_no,container_no,bl_no,broker,status,flagged,goal_date,ata_sam,ata_port,customs_release_date,eta_port_update,is_critical,invoice_type" as const;

export type KpiRow = Pick<
  ShipmentViewRow,
  | "invoice_no"
  | "container_no"
  | "bl_no"
  | "broker"
  | "status"
  | "flagged"
  | "goal_date"
  | "ata_sam"
  | "ata_port"
  | "customs_release_date"
  | "eta_port_update"
  | "is_critical"
  | "invoice_type"
>;

export type ContainerSummary = {
  key: string;
  containerNo: string | null;
  blNo: string | null;
  broker: string | null;
  invoices: string[];
  status: ShipmentStatus;
  delayed: boolean;
  critical: boolean;
  goalDate: string | null;
  ataSam: string | null;
  ataPort: string | null;
  customsRelease: string | null;
  etaPort: string | null;
};

const DAY = 86_400_000;
const toMs = (d: string | null) => (d ? Date.parse(`${d}T00:00:00Z`) : null);
const minDate = (a: string | null, b: string | null) => (!a ? b : !b ? a : a < b ? a : b);
const maxDate = (a: string | null, b: string | null) => (!a ? b : !b ? a : a > b ? a : b);

/** Groups invoice rows into containers (LCL invoices without a container stand alone). */
export function toContainers(rows: KpiRow[]): ContainerSummary[] {
  const map = new Map<string, ContainerSummary & { _statuses: ShipmentStatus[] }>();
  for (const r of rows) {
    const key = r.container_no ?? `INV:${r.invoice_no}`;
    let c = map.get(key);
    if (!c) {
      c = {
        key,
        containerNo: r.container_no,
        blNo: r.bl_no,
        broker: r.broker,
        invoices: [],
        status: r.status,
        delayed: false,
        critical: false,
        goalDate: null,
        ataSam: null,
        ataPort: null,
        customsRelease: null,
        etaPort: null,
        _statuses: [],
      };
      map.set(key, c);
    }
    c.invoices.push(r.invoice_no);
    c._statuses.push(r.status);
    c.delayed ||= r.flagged === "DELAYED";
    c.critical ||= r.is_critical === true;
    c.blNo ??= r.bl_no;
    c.broker ??= r.broker;
    c.goalDate = minDate(c.goalDate, r.goal_date); // strictest goal among its invoices
    c.ataSam = maxDate(c.ataSam, r.ata_sam); // delivered when the last invoice arrives
    c.ataPort = minDate(c.ataPort, r.ata_port);
    c.customsRelease = maxDate(c.customsRelease, r.customs_release_date);
    c.etaPort = minDate(c.etaPort, r.eta_port_update);
  }
  return [...map.values()].map(({ _statuses, ...c }) => ({ ...c, status: rollUpStatus(_statuses) }));
}

export type DashboardKpis = {
  activeContainers: number;
  inPort: number;
  inTransitToPlant: number;
  delayedActive: number;
  criticalActive: number;
  deliveredLast30: number;
  onTimeRateLast30: number | null;
  avgCustomsDaysLast30: number | null;
  needsReview: number;
  byStatus: { status: ShipmentStatus; count: number }[];
  arrivalsByWeek: { week: string; count: number }[];
  onTimeByBroker: { broker: string; delivered: number; onTimeRate: number }[];
  attention: ContainerSummary[];
};

function mondayOf(ms: number) {
  const d = new Date(ms);
  const dow = (d.getUTCDay() + 6) % 7;
  return new Date(ms - dow * DAY).toISOString().slice(0, 10);
}

/** `today` is injected (YYYY-MM-DD) so results are deterministic and testable. */
export function computeKpis(rows: KpiRow[], today: string, customsTargetDays = 10): DashboardKpis {
  const containers = toContainers(rows);
  const todayMs = toMs(today)!;
  const since30 = todayMs - 30 * DAY;
  const since90 = todayMs - 90 * DAY;

  const active = containers.filter((c) => !isDelivered(c.status));
  const delivered30 = containers.filter((c) => {
    if (!isDelivered(c.status)) return false;
    const t = toMs(c.ataSam);
    return t != null && t > since30 && t <= todayMs;
  });
  const onTime30 = delivered30.filter((c) => !c.delayed).length;

  const customsDays = delivered30
    .map((c) => (c.ataPort && c.customsRelease ? (toMs(c.customsRelease)! - toMs(c.ataPort)!) / DAY : null))
    .filter((d): d is number => d != null && d >= 0);

  const byStatus = STATUS_ORDER.map((status) => ({
    status,
    count: containers.filter((c) => c.status === status).length,
  })).filter((s) => s.count > 0);

  // Next 6 weeks of port arrivals for containers that have not arrived yet.
  const weeks = Array.from({ length: 6 }, (_, i) => mondayOf(todayMs + i * 7 * DAY));
  const arrivalsByWeek = weeks.map((week) => ({ week, count: 0 }));
  for (const c of active) {
    if (c.ataPort || !c.etaPort) continue;
    const w = mondayOf(Math.max(toMs(c.etaPort)!, todayMs)); // overdue ETAs count in this week
    const slot = arrivalsByWeek.find((x) => x.week === w);
    if (slot) slot.count++;
  }

  const brokerMap = new Map<string, { delivered: number; onTime: number }>();
  for (const c of containers) {
    if (!isDelivered(c.status)) continue;
    const t = toMs(c.ataSam);
    if (t == null || t <= since90 || t > todayMs) continue;
    const b = c.broker ?? "Unassigned";
    const e = brokerMap.get(b) ?? { delivered: 0, onTime: 0 };
    e.delivered++;
    if (!c.delayed) e.onTime++;
    brokerMap.set(b, e);
  }
  const onTimeByBroker = [...brokerMap.entries()]
    .map(([broker, e]) => ({ broker, delivered: e.delivered, onTimeRate: Math.round((1000 * e.onTime) / e.delivered) / 10 }))
    .sort((a, b) => b.delivered - a.delivered);

  // Attention list: active containers that are delayed, critical, or stuck in customs past target.
  const score = (c: ContainerSummary) => {
    let s = 0;
    if (c.delayed) s += 8;
    if (c.critical) s += 5;
    if (c.ataPort && !c.customsRelease && (todayMs - toMs(c.ataPort)!) / DAY > customsTargetDays) s += 3;
    if (!c.ataPort && c.etaPort && toMs(c.etaPort)! < todayMs) s += 3;
    return s;
  };
  const attention = active
    .map((c) => ({ c, s: score(c) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || (a.c.goalDate ?? "9").localeCompare(b.c.goalDate ?? "9"))
    .slice(0, 15)
    .map((x) => x.c);

  return {
    activeContainers: active.length,
    inPort: active.filter((c) => c.status === "In Port (MX)" || c.status === "In customs").length,
    inTransitToPlant: active.filter((c) => c.status === "In transit to Plant").length,
    delayedActive: active.filter((c) => c.delayed).length,
    criticalActive: active.filter((c) => c.critical).length,
    deliveredLast30: delivered30.length,
    onTimeRateLast30: delivered30.length ? Math.round((1000 * onTime30) / delivered30.length) / 10 : null,
    avgCustomsDaysLast30: customsDays.length
      ? Math.round((10 * customsDays.reduce((a, b) => a + b, 0)) / customsDays.length) / 10
      : null,
    needsReview: containers.filter((c) => c.status === "Review status").length,
    byStatus,
    arrivalsByWeek,
    onTimeByBroker,
    attention,
  };
}
