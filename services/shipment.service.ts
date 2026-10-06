import "server-only";
import { createClient } from "@/lib/supabase/server";
import { KPI_COLUMNS, type KpiRow } from "@/domain/kpi";
import type { ShipmentStatus, ShipmentViewRow } from "@/types/database.types";

// All reads go through the signed-in user's client, so RLS applies.

const PAGE = 1000; // PostgREST max-rows default

/** Reads every row of the dashboard projection in pages of 1000. */
export async function fetchKpiRows(): Promise<KpiRow[]> {
  const supabase = await createClient();
  const out: KpiRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("shipments_view")
      .select(KPI_COLUMNS)
      .order("invoice_no")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`Could not load shipments: ${error.message}`);
    out.push(...(data as KpiRow[]));
    if (data.length < PAGE) return out;
  }
}

export const SEARCH_FIELDS = {
  invoice: { column: "invoice_no", label: "Invoice" },
  container: { column: "container_no", label: "Container" },
  bl: { column: "bl_no", label: "BL" },
} as const;
export type SearchField = keyof typeof SEARCH_FIELDS;

export const LIST_COLUMNS =
  "id,invoice_no,bl_no,container_no,broker,plant,shipping_line,terminal,status,flagged,eta_port_update,ata_port,customs_release_date,goal_date,ata_sam,is_critical,invoice_type,days_in_progress" as const;
export type ShipmentListRow = Pick<
  ShipmentViewRow,
  | "id"
  | "invoice_no"
  | "bl_no"
  | "container_no"
  | "broker"
  | "plant"
  | "shipping_line"
  | "terminal"
  | "status"
  | "flagged"
  | "eta_port_update"
  | "ata_port"
  | "customs_release_date"
  | "goal_date"
  | "ata_sam"
  | "is_critical"
  | "invoice_type"
  | "days_in_progress"
>;

export type ShipmentQuery = {
  q?: string;
  field?: SearchField;
  status?: ShipmentStatus;
  flagged?: "DELAYED" | "ON TIME";
  broker?: string;
  critical?: boolean;
  activeOnly?: boolean;
  page?: number;
  pageSize?: number;
};

// PostgREST `ilike` patterns: escape the wildcard characters a user might type.
const likeEscape = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

export async function listShipments(q: ShipmentQuery) {
  const supabase = await createClient();
  const pageSize = Math.min(Math.max(q.pageSize ?? 50, 10), 200);
  const page = Math.max(q.page ?? 1, 1);

  let query = supabase.from("shipments_view").select(LIST_COLUMNS, { count: "exact" });

  const term = q.q?.trim().toUpperCase().replace(/\s+/g, "");
  if (term) {
    const pattern = `%${likeEscape(term)}%`;
    if (q.field) {
      query = query.ilike(SEARCH_FIELDS[q.field].column, pattern);
    } else {
      // Quote the pattern so commas or parentheses in user input can't alter the filter.
      const quoted = `"${pattern.replace(/"/g, '\\"')}"`;
      query = query.or(`invoice_no.ilike.${quoted},container_no.ilike.${quoted},bl_no.ilike.${quoted}`);
    }
  }
  if (q.status) query = query.eq("status", q.status);
  if (q.flagged) query = query.eq("flagged", q.flagged);
  if (q.broker) query = query.eq("broker", q.broker);
  if (q.critical) query = query.eq("is_critical", true);
  if (q.activeOnly) query = query.not("status", "like", "Delivered%");

  const { data, error, count } = await query
    .order("eta_port_update", { ascending: false, nullsFirst: false })
    .order("invoice_no")
    .range((page - 1) * pageSize, page * pageSize - 1);
  if (error) throw new Error(`Could not load shipments: ${error.message}`);

  return { rows: (data ?? []) as ShipmentListRow[], total: count ?? 0, page, pageSize };
}

export async function getShipment(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("shipments_view").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`Could not load shipment: ${error.message}`);
  if (!data) return null;

  const shipment = data as ShipmentViewRow;
  // Other invoices travelling in the same container (or under the same BL when there is no container).
  const siblingsQuery = supabase.from("shipments_view").select(LIST_COLUMNS).neq("id", id).limit(50);
  const { data: siblings } = shipment.container_no
    ? await siblingsQuery.eq("container_no", shipment.container_no)
    : shipment.bl_no
      ? await siblingsQuery.eq("bl_no", shipment.bl_no)
      : { data: [] };

  return { shipment, siblings: (siblings ?? []) as ShipmentListRow[] };
}

export async function listBrokers(): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("shipments").select("broker").not("broker", "is", null).limit(5000);
  return [...new Set((data ?? []).map((r) => r.broker as string))].sort();
}
