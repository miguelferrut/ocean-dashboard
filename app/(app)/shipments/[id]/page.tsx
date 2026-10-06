import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FlagBadge, StatusBadge } from "@/components/shipments/status-badge";
import { Badge, ButtonLink, Card, CardTitle, PageHeader } from "@/components/ui";
import { requirePermission } from "@/lib/auth/session";
import { fmtDate, fmtMoney, fmtNumber } from "@/lib/format";
import { getShipment } from "@/services/shipment.service";
import type { ShipmentViewRow } from "@/types/database.types";

export const metadata: Metadata = { title: "Shipment" };

const UUID = /^[0-9a-f-]{36}$/i;

// The milestone timeline, in process order. Each step lists the date that marks it done.
const MILESTONES: { label: string; done: keyof ShipmentViewRow; plan?: keyof ShipmentViewRow; owner: string }[] = [
  { label: "Departed origin port", done: "atd_port", owner: "Forwarder" },
  { label: "Arrived at MX port", done: "ata_port", plan: "eta_port_update", owner: "Shipping line" },
  { label: "Container discharged", done: "effective_discharge_date", owner: "Terminal" },
  { label: "BL revalidated", done: "bl_revalidation_date", owner: "Broker" },
  { label: "Proforma created", done: "proforma_creation_date", owner: "Broker" },
  { label: "Pedimento approved", done: "pedimento_approved_date", owner: "SAM team" },
  { label: "Pedimento paid", done: "pedimento_payment_date", owner: "Broker" },
  { label: "Customs release", done: "customs_release_date", plan: "eta_customs_appointment", owner: "Terminal" },
  { label: "Truck assigned", done: "transport_assignment_date", owner: "Carrier" },
  { label: "Arrived at SAM", done: "ata_sam", plan: "eta_sam_real", owner: "Carrier" },
  { label: "Empty returned", done: "empty_return_date", owner: "Carrier" },
];

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-0.5 font-medium break-words">{children ?? "—"}</dd>
    </div>
  );
}

export default async function ShipmentPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("shipments:view");
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const result = await getShipment(id);
  if (!result) notFound();
  const { shipment: s, siblings } = result;

  return (
    <>
      <PageHeader
        title={s.invoice_no}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge status={s.status} />
            <FlagBadge flagged={s.flagged} />
            {s.is_critical && <Badge tone="warning">Critical</Badge>}
            {s.invoice_type !== "Normal" && <Badge>{s.invoice_type}</Badge>}
          </span>
        }
        actions={<ButtonLink href="/shipments">← All shipments</ButtonLink>}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardTitle>Identifiers & routing</CardTitle>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Detail label="Container">{s.container_no}</Detail>
            <Detail label="BL">{s.bl_no}</Detail>
            <Detail label="ASN">{s.asn}</Detail>
            <Detail label="Origin">{s.point_origin}</Detail>
            <Detail label="Incoterm">{s.incoterm}</Detail>
            <Detail label="Forwarder">{s.forwarder}</Detail>
            <Detail label="Shipping line">{s.shipping_line}</Detail>
            <Detail label="Vessel / voyage">{[s.vessel, s.voyage_no].filter(Boolean).join(" / ") || null}</Detail>
            <Detail label="Terminal">{s.terminal}</Detail>
            <Detail label="Broker">{s.broker}</Detail>
            <Detail label="Broker reference">{s.broker_reference}</Detail>
            <Detail label="Carrier">{s.carrier}</Detail>
            <Detail label="Plant / project">{[s.plant, s.project].filter(Boolean).join(" / ") || null}</Detail>
            <Detail label="Plant delivery">{s.plant_delivery}</Detail>
            <Detail label="Coordinator">{s.coordinator}</Detail>
          </dl>
        </Card>

        <Card>
          <CardTitle>Commercial & customs</CardTitle>
          <dl className="grid grid-cols-2 gap-4">
            <Detail label="Invoice value">{fmtMoney(s.invoice_total_value, s.currency)}</Detail>
            <Detail label="Weight">{s.weight_kg == null ? null : `${fmtNumber(s.weight_kg)} kg`}</Detail>
            <Detail label="Pallets">{s.pallets}</Detail>
            <Detail label="Material">{s.material_type}</Detail>
            <Detail label="Clave">{s.clave}</Detail>
            <Detail label="IMMEX">{s.immex}</Detail>
            <Detail label="Pedimento">{s.pedimento_no}</Detail>
            <Detail label="Modulation">{s.modulation_status}</Detail>
            <Detail label="Needs AAA">{s.needs_aaa ? "Yes" : "No"}</Detail>
            <Detail label="Days in progress">{s.days_in_progress}</Detail>
          </dl>
        </Card>

        <Card className="lg:col-span-2">
          <CardTitle>Milestones</CardTitle>
          <ol className="relative flex flex-col gap-3 border-l-2 border-line pl-5">
            {MILESTONES.map((m) => {
              const done = s[m.done] as string | null;
              const plan = m.plan ? (s[m.plan] as string | null) : null;
              return (
                <li key={m.label} className="relative">
                  <span
                    aria-hidden="true"
                    className={`absolute -left-[27px] top-1 size-3 rounded-full border-2 ${done ? "border-teal bg-teal" : "border-line bg-surface"}`}
                  />
                  <p className="font-semibold">
                    {m.label} <span className="font-normal text-muted">· {m.owner}</span>
                  </p>
                  <p className="tabular text-sm text-muted">
                    {done ? <>Done {fmtDate(done)}</> : plan ? <>Planned {fmtDate(plan)}</> : "Pending"}
                  </p>
                </li>
              );
            })}
          </ol>
        </Card>

        <Card>
          <CardTitle>Plan vs goal</CardTitle>
          <dl className="grid gap-4">
            <Detail label="ETA port (origin)">{fmtDate(s.eta_port_by_origin)}</Detail>
            <Detail label="ETA port (updated)">{fmtDate(s.eta_port_update)}</Detail>
            <Detail label="ETA SAM goal">{fmtDate(s.goal_date)}</Detail>
            <Detail label="ETA SAM (real)">{fmtDate(s.eta_sam_real)}</Detail>
            <Detail label="Impact date (critical)">{fmtDate(s.impact_date)}</Detail>
            {s.gps_link && /^https:\/\//.test(s.gps_link) && (
              <Detail label="GPS">
                <a href={s.gps_link} target="_blank" rel="noopener noreferrer" className="text-brand underline">
                  Open tracking ↗
                </a>
              </Detail>
            )}
          </dl>
        </Card>

        {siblings.length > 0 && (
          <Card className="lg:col-span-3">
            <CardTitle>{s.container_no ? "Other invoices in this container" : "Other invoices on this BL"}</CardTitle>
            <ul className="flex flex-wrap gap-2">
              {siblings.map((x) => (
                <li key={x.id}>
                  <Link href={`/shipments/${x.id}`} className="inline-flex items-center gap-2 rounded-md border border-line px-3 py-1.5 text-sm hover:bg-surface-2">
                    <span className="font-semibold">{x.invoice_no}</span>
                    <StatusBadge status={x.status} />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </>
  );
}
