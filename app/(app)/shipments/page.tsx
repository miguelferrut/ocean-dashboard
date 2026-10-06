import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { FlagBadge, StatusBadge } from "@/components/shipments/status-badge";
import { Button, ButtonLink, EmptyState, Field, Input, PageHeader, Select } from "@/components/ui";
import { STATUS_ORDER } from "@/domain/status";
import { requirePermission } from "@/lib/auth/session";
import { fmtDate } from "@/lib/format";
import { listBrokers, listShipments, SEARCH_FIELDS, type SearchField } from "@/services/shipment.service";
import type { ShipmentStatus } from "@/types/database.types";

export const metadata: Metadata = { title: "Shipments" };

type Params = {
  q?: string;
  field?: string;
  status?: string;
  flagged?: string;
  broker?: string;
  critical?: string;
  active?: string;
  page?: string;
};

export default async function ShipmentsPage({ searchParams }: { searchParams: Promise<Params> }) {
  await requirePermission("shipments:view");
  const sp = await searchParams;

  const field = sp.field && sp.field in SEARCH_FIELDS ? (sp.field as SearchField) : undefined;
  const status = STATUS_ORDER.includes(sp.status as ShipmentStatus) ? (sp.status as ShipmentStatus) : undefined;
  const flagged = sp.flagged === "DELAYED" || sp.flagged === "ON TIME" ? sp.flagged : undefined;

  const [result, brokers] = await Promise.all([
    listShipments({
      q: sp.q,
      field,
      status,
      flagged,
      broker: sp.broker || undefined,
      critical: sp.critical === "1",
      activeOnly: sp.active === "1",
      page: Number(sp.page) || 1,
    }),
    listBrokers(),
  ]);

  // A search that pins down exactly one invoice goes straight to it.
  if (sp.q && result.total === 1 && result.page === 1) redirect(`/shipments/${result.rows[0].id}`);

  const pages = Math.max(Math.ceil(result.total / result.pageSize), 1);
  const linkFor = (page: number) => {
    const p = new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][]);
    p.set("page", String(page));
    return `/shipments?${p}`;
  };

  return (
    <>
      <PageHeader
        title="Shipments"
        description="One row per commercial invoice. Search by invoice, container or BL."
      />

      <form method="get" className="mb-4 grid grid-cols-2 gap-3 rounded-lg border border-line bg-surface p-4 md:grid-cols-4 lg:grid-cols-8">
        <div className="col-span-2 lg:col-span-3">
          <Field label="Search" htmlFor="q">
            <Input id="q" name="q" type="search" defaultValue={sp.q} placeholder="e.g. SHAUSMEX260507, PIDU4077791" />
          </Field>
        </div>
        <Field label="In" htmlFor="field">
          <Select id="field" name="field" defaultValue={field ?? ""}>
            <option value="">All IDs</option>
            {Object.entries(SEARCH_FIELDS).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </Select>
        </Field>
        <Field label="Stage" htmlFor="status">
          <Select id="status" name="status" defaultValue={status ?? ""}>
            <option value="">Any</option>
            {STATUS_ORDER.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </Select>
        </Field>
        <Field label="Flag" htmlFor="flagged">
          <Select id="flagged" name="flagged" defaultValue={flagged ?? ""}>
            <option value="">Any</option>
            <option value="DELAYED">Delayed</option>
            <option value="ON TIME">On time</option>
          </Select>
        </Field>
        <Field label="Broker" htmlFor="broker">
          <Select id="broker" name="broker" defaultValue={sp.broker ?? ""}>
            <option value="">Any</option>
            {brokers.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </Select>
        </Field>
        <div className="col-span-2 flex flex-wrap items-end gap-x-4 gap-y-2 md:col-span-4 lg:col-span-8">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="active" value="1" defaultChecked={sp.active === "1"} className="size-4" />
            Not yet delivered
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="critical" value="1" defaultChecked={sp.critical === "1"} className="size-4" />
            Critical only
          </label>
          <div className="ml-auto flex gap-2">
            <ButtonLink href="/shipments" variant="ghost">Clear</ButtonLink>
            <Button type="submit">Apply</Button>
          </div>
        </div>
      </form>

      <p className="mb-2 text-sm text-muted" aria-live="polite">
        {result.total.toLocaleString("en-US")} invoice{result.total === 1 ? "" : "s"}
        {pages > 1 && ` · page ${result.page} of ${pages}`}
      </p>

      {result.rows.length === 0 ? (
        <EmptyState title="No shipments match">Try a shorter search term or clear the filters.</EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line bg-surface">
          <table className="w-full min-w-[960px] text-left text-sm">
            <caption className="sr-only">Shipments</caption>
            <thead className="bg-surface-2 text-xs uppercase text-muted">
              <tr>
                <th scope="col" className="px-3 py-2.5">Invoice</th>
                <th scope="col" className="px-3 py-2.5">Container</th>
                <th scope="col" className="px-3 py-2.5">BL</th>
                <th scope="col" className="px-3 py-2.5">Stage</th>
                <th scope="col" className="px-3 py-2.5">Flag</th>
                <th scope="col" className="px-3 py-2.5">ETA port</th>
                <th scope="col" className="px-3 py-2.5">Released</th>
                <th scope="col" className="px-3 py-2.5">Goal SAM</th>
                <th scope="col" className="px-3 py-2.5">Broker</th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((r) => (
                <tr key={r.id} className="border-t border-line hover:bg-surface-2">
                  <td className="px-3 py-2">
                    <Link href={`/shipments/${r.id}`} className="font-semibold text-brand underline-offset-2 hover:underline">
                      {r.invoice_no}
                    </Link>
                    {r.is_critical && <span className="ml-1.5 text-xs font-semibold text-amber">CRIT</span>}
                    {r.invoice_type !== "Normal" && <span className="ml-1.5 text-xs text-muted">{r.invoice_type}</span>}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{r.container_no ?? "—"}</td>
                  <td className="px-3 py-2 font-mono text-xs">{r.bl_no ?? "—"}</td>
                  <td className="px-3 py-2"><StatusBadge status={r.status} /></td>
                  <td className="px-3 py-2"><FlagBadge flagged={r.flagged} /></td>
                  <td className="tabular px-3 py-2">{fmtDate(r.eta_port_update)}</td>
                  <td className="tabular px-3 py-2">{fmtDate(r.customs_release_date)}</td>
                  <td className="tabular px-3 py-2">{fmtDate(r.goal_date)}</td>
                  <td className="px-3 py-2">{r.broker ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 && (
        <nav aria-label="Pagination" className="mt-4 flex items-center justify-between">
          {result.page > 1 ? <ButtonLink href={linkFor(result.page - 1)}>← Previous</ButtonLink> : <span />}
          {result.page < pages ? <ButtonLink href={linkFor(result.page + 1)}>Next →</ButtonLink> : <span />}
        </nav>
      )}
    </>
  );
}
