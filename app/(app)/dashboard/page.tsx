import type { Metadata } from "next";
import Link from "next/link";
import { BarList } from "@/components/charts/bar-list";
import { FlagBadge, StatusBadge } from "@/components/shipments/status-badge";
import { Alert, ButtonLink, Card, CardTitle, EmptyState, PageHeader, StatTile } from "@/components/ui";
import { computeKpis } from "@/domain/kpi";
import { can } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import { fmtDate, todayISO } from "@/lib/format";
import { getSettings } from "@/services/settings.service";
import { fetchKpiRows } from "@/services/shipment.service";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ denied?: string; passwordUpdated?: string }>;
}) {
  const user = await requirePermission("dashboard:view");
  const { denied, passwordUpdated } = await searchParams;
  const today = todayISO();
  const [rows, settings] = await Promise.all([fetchKpiRows(), getSettings()]);

  if (!rows.length) {
    return (
      <>
        <PageHeader title="Dashboard" description="From origin port to SAM, through Mexican ports and customs." />
        <EmptyState title="No shipments yet">
          {can(user.profile.role, "shipments:import") ? (
            <>
              Upload the Ocean Master Data Base workbook to get started.{" "}
              <Link href="/imports" className="font-semibold text-brand underline">
                Go to Excel imports
              </Link>
            </>
          ) : (
            "An admin or supervisor needs to upload the Excel workbook."
          )}
        </EmptyState>
      </>
    );
  }

  const k = computeKpis(rows, today, settings.targets.customsDays);

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={<>Containers from origin port to SAM · as of {fmtDate(today)}</>}
        actions={<ButtonLink href="/shipments?active=1">Open tracker</ButtonLink>}
      />
      <div className="flex flex-col gap-4">
        {denied && <Alert tone="warning">You don&apos;t have access to that page.</Alert>}
        {passwordUpdated && <Alert tone="success">Your password was updated.</Alert>}

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatTile label="Active containers" value={k.activeContainers} hint="Not yet delivered to plant" />
          <StatTile label="In port / customs (MX)" value={k.inPort} />
          <StatTile
            label="Delayed (active)"
            value={k.delayedActive}
            tone={k.delayedActive ? "danger" : undefined}
            hint="Past ETA SAM goal"
          />
          <StatTile
            label="Critical (active)"
            value={k.criticalActive}
            tone={k.criticalActive ? "warning" : undefined}
          />
          <StatTile label="Delivered, last 30 days" value={k.deliveredLast30} />
          <StatTile
            label="On time, last 30 days"
            value={k.onTimeRateLast30 == null ? "—" : `${k.onTimeRateLast30}%`}
            hint="Delivered by ETA SAM goal"
          />
          <StatTile
            label="Avg. port → release"
            value={k.avgCustomsDaysLast30 == null ? "—" : `${k.avgCustomsDaysLast30} d`}
            hint={`Deliveries in the last 30 days · target ${settings.targets.customsDays} d`}
          />
          <StatTile
            label="Need status review"
            value={k.needsReview}
            tone={k.needsReview ? "warning" : undefined}
            hint="Dates don't fit any stage"
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardTitle>Containers by stage</CardTitle>
            <BarList
              caption="Containers by stage"
              valueHeader="Containers"
              data={k.byStatus.map((s) => ({ label: s.status, value: s.count }))}
            />
          </Card>
          <Card>
            <CardTitle>Port arrivals, next 6 weeks</CardTitle>
            <BarList
              caption="Containers expected at a Mexican port, by week (overdue ETAs count in the current week)"
              valueHeader="Containers"
              data={k.arrivalsByWeek.map((w, i) => ({
                label: i === 0 ? `This week (${fmtDate(w.week).slice(0, 6)})` : `Week of ${fmtDate(w.week).slice(0, 6)}`,
                value: w.count,
              }))}
            />
          </Card>
        </div>

        <Card>
          <CardTitle>On-time delivery by broker, last 90 days</CardTitle>
          <BarList
            caption="On-time delivery rate by customs broker, last 90 days"
            valueHeader="On time"
            max={100}
            emptyText="No deliveries in the last 90 days."
            data={k.onTimeByBroker.map((b) => ({
              label: b.broker,
              value: b.onTimeRate,
              display: `${b.onTimeRate}%`,
              hint: `${b.delivered} containers delivered`,
            }))}
          />
        </Card>

        <Card>
          <CardTitle action={<ButtonLink href="/shipments?flagged=DELAYED&active=1">All delayed</ButtonLink>}>
            Needs attention
          </CardTitle>
          {k.attention.length === 0 ? (
            <p className="text-sm text-muted">Nothing delayed, critical or stuck in customs. 🎉</p>
          ) : (
            <div className="-mx-4 overflow-x-auto sm:mx-0">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="text-xs uppercase text-muted">
                  <tr>
                    <th scope="col" className="px-4 py-2 sm:px-2">Container</th>
                    <th scope="col" className="px-2 py-2">Stage</th>
                    <th scope="col" className="px-2 py-2">Flag</th>
                    <th scope="col" className="px-2 py-2">ETA port</th>
                    <th scope="col" className="px-2 py-2">Goal at SAM</th>
                    <th scope="col" className="px-2 py-2">Broker</th>
                  </tr>
                </thead>
                <tbody>
                  {k.attention.map((c) => (
                    <tr key={c.key} className="border-t border-line">
                      <td className="px-4 py-2 sm:px-2">
                        <Link
                          href={`/shipments?q=${encodeURIComponent(c.containerNo ?? c.invoices[0])}&field=${c.containerNo ? "container" : "invoice"}`}
                          className="font-semibold text-brand underline-offset-2 hover:underline"
                        >
                          {c.containerNo ?? c.invoices[0]}
                        </Link>
                        {c.critical && <span className="ml-2 text-xs font-semibold text-amber">CRITICAL</span>}
                      </td>
                      <td className="px-2 py-2"><StatusBadge status={c.status} /></td>
                      <td className="px-2 py-2"><FlagBadge flagged={c.delayed ? "DELAYED" : "ON TIME"} /></td>
                      <td className="tabular px-2 py-2">{fmtDate(c.etaPort)}</td>
                      <td className="tabular px-2 py-2">{fmtDate(c.goalDate)}</td>
                      <td className="px-2 py-2">{c.broker ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
