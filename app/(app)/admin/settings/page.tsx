import type { Metadata } from "next";
import { SettingsForm } from "@/components/admin-forms";
import { Card, CardTitle, PageHeader } from "@/components/ui";
import { requirePermission } from "@/lib/auth/session";
import { fmtDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/services/settings.service";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  await requirePermission("settings:manage");
  const supabase = await createClient();
  const [settings, { data: audit }] = await Promise.all([
    getSettings(),
    supabase
      .from("audit_log")
      .select("id,table_name,record_id,action,new_data,actor_id,created_at")
      .neq("table_name", "shipments")
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  return (
    <>
      <PageHeader title="Settings" description="Business rules used to compute goals and KPIs." />
      <div className="flex flex-col gap-4">
        <Card>
          <CardTitle>Goals and targets</CardTitle>
          <SettingsForm allowance={settings.goalAllowance} targets={settings.targets} />
        </Card>
        <Card>
          <CardTitle>Recent administrative changes</CardTitle>
          <p className="mb-3 text-sm text-muted">
            Every change to users, settings and shipments is recorded in the audit log. Shipment history is kept per record.
          </p>
          <ul className="flex flex-col divide-y divide-line text-sm">
            {audit?.map((a) => (
              <li key={a.id} className="flex flex-wrap gap-x-3 py-2">
                <span className="tabular text-muted">{fmtDateTime(a.created_at)}</span>
                <span className="font-semibold">{a.action}</span>
                <span>{a.table_name}</span>
                <span className="truncate font-mono text-xs text-muted">
                  {a.new_data ? Object.keys(a.new_data as object).slice(0, 4).join(", ") : a.record_id}
                </span>
              </li>
            ))}
            {!audit?.length && <li className="py-2 text-muted">No changes yet.</li>}
          </ul>
        </Card>
      </div>
    </>
  );
}
