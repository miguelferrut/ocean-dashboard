import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Badge, ButtonLink, Card, CardTitle, PageHeader, StatTile } from "@/components/ui";
import { requirePermission } from "@/lib/auth/session";
import { fmtDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Import report" };

export default async function ImportReportPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("imports:view");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const supabase = await createClient();
  const [{ data: batch }, { data: issues }] = await Promise.all([
    supabase.from("import_batches").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("import_issues")
      .select("row_number,invoice_no,field,value,severity,message")
      .eq("batch_id", id)
      .order("severity")
      .order("row_number")
      .limit(1000),
  ]);
  if (!batch) notFound();

  const errors = issues?.filter((i) => i.severity === "error") ?? [];
  const warnings = issues?.filter((i) => i.severity === "warning") ?? [];

  return (
    <>
      <PageHeader
        title="Import report"
        description={<>{batch.file_name} · {fmtDateTime(batch.created_at)}</>}
        actions={<ButtonLink href="/imports">← All imports</ButtonLink>}
      />
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatTile label="Rows in file" value={batch.rows_total} />
          <StatTile label="Imported" value={batch.rows_imported} />
          <StatTile label="Rejected" value={batch.rows_rejected} tone={batch.rows_rejected ? "danger" : undefined} />
          <StatTile label="Warnings" value={warnings.length} tone={warnings.length ? "warning" : undefined} />
        </div>

        {[
          { title: "Rejected rows", list: errors, tone: "danger" as const, empty: "No rows were rejected." },
          { title: "Warnings (row imported, value left empty)", list: warnings, tone: "warning" as const, empty: "No warnings." },
        ].map((section) => (
          <Card key={section.title}>
            <CardTitle>{section.title}</CardTitle>
            {section.list.length === 0 ? (
              <p className="text-sm text-muted">{section.empty}</p>
            ) : (
              <div className="-mx-4 overflow-x-auto sm:mx-0">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="text-xs uppercase text-muted">
                    <tr>
                      <th scope="col" className="px-4 py-2 sm:px-2">Excel row</th>
                      <th scope="col" className="px-2 py-2">Invoice</th>
                      <th scope="col" className="px-2 py-2">Column</th>
                      <th scope="col" className="px-2 py-2">Value</th>
                      <th scope="col" className="px-2 py-2">Problem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {section.list.map((i, n) => (
                      <tr key={n} className="border-t border-line">
                        <td className="tabular px-4 py-2 sm:px-2">{i.row_number || "—"}</td>
                        <td className="px-2 py-2 font-mono text-xs">{i.invoice_no ?? "—"}</td>
                        <td className="px-2 py-2">{i.field ?? "—"}</td>
                        <td className="max-w-48 truncate px-2 py-2">{i.value || "—"}</td>
                        <td className="px-2 py-2">
                          <Badge tone={section.tone}>{i.severity}</Badge> {i.message}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        ))}
      </div>
    </>
  );
}
