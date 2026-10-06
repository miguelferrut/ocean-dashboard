import { describe, expect, it } from "vitest";
import { computeKpis, toContainers, type KpiRow } from "@/domain/kpi";

const r = (over: Partial<KpiRow>): KpiRow => ({
  invoice_no: "INV",
  container_no: null,
  bl_no: null,
  broker: "GOMSA",
  status: "In transit to port",
  flagged: "ON TIME",
  goal_date: null,
  ata_sam: null,
  ata_port: null,
  customs_release_date: null,
  eta_port_update: null,
  is_critical: false,
  invoice_type: "Normal",
  ...over,
});

describe("toContainers", () => {
  it("rolls invoices up to the least advanced status", () => {
    const [c] = toContainers([
      r({ invoice_no: "A", container_no: "C1", status: "Delivered at Sanhua" }),
      r({ invoice_no: "B", container_no: "C1", status: "In Port (MX)", flagged: "DELAYED" }),
    ]);
    expect(c.status).toBe("In Port (MX)");
    expect(c.delayed).toBe(true);
    expect(c.invoices).toEqual(["A", "B"]);
  });
  it("keeps container-less invoices separate", () => {
    expect(toContainers([r({ invoice_no: "A" }), r({ invoice_no: "B" })])).toHaveLength(2);
  });
});

describe("computeKpis", () => {
  const today = "2026-10-06";
  const rows = [
    r({ invoice_no: "1", container_no: "C1", status: "Delivered at Sanhua", ata_sam: "2026-10-01", ata_port: "2026-09-20", customs_release_date: "2026-09-26" }),
    r({ invoice_no: "2", container_no: "C2", status: "Delivered at Sanhua", ata_sam: "2026-09-30", flagged: "DELAYED", ata_port: "2026-09-20", customs_release_date: "2026-09-30" }),
    r({ invoice_no: "3", container_no: "C3", status: "In Port (MX)", ata_port: "2026-09-20", is_critical: true }),
    r({ invoice_no: "4", container_no: "C4", status: "In transit to port", eta_port_update: "2026-10-08" }),
    r({ invoice_no: "5", container_no: "C5", status: "In transit to port", eta_port_update: "2026-10-01", flagged: "DELAYED" }),
  ];
  const k = computeKpis(rows, today);

  it("counts active, delivered and on-time", () => {
    expect(k.activeContainers).toBe(3);
    expect(k.inPort).toBe(1);
    expect(k.deliveredLast30).toBe(2);
    expect(k.onTimeRateLast30).toBe(50);
    expect(k.avgCustomsDaysLast30).toBe(8); // (6 + 10) / 2
    expect(k.criticalActive).toBe(1);
    expect(k.delayedActive).toBe(1);
  });

  it("buckets upcoming and overdue arrivals by week", () => {
    expect(k.arrivalsByWeek[0]).toEqual({ week: "2026-10-05", count: 2 }); // overdue C5 + C4
  });

  it("ranks the attention list: delayed before critical-in-customs", () => {
    expect(k.attention.map((c) => c.containerNo)).toEqual(["C5", "C3"]);
  });

  it("reports on-time by broker for the last 90 days", () => {
    expect(k.onTimeByBroker).toEqual([{ broker: "GOMSA", delivered: 2, onTimeRate: 50 }]);
  });
});
