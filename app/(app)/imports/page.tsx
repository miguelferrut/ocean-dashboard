import type { Metadata } from "next";
import Link from "next/link";
import { ImportUploader } from "@/components/import-uploader";
import { Badge, Card, CardTitle, EmptyState, PageHeader } from "@/components/ui";
import { can } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import { fmtDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Excel imports" };
// Large workbooks take a few seconds to parse; give the server action room.
export const maxDuration = 60;

export default async function ImportsPage() {
  const user = await requirePermission("imports:view");
  const supabase = await createClient();
  const { data: batches } = await supabase
    .from("import_batches")
    .select("id,file_name,status,rows_total,rows_imported,rows_rejected,created_at,uploaded_by")
    .order("created_at", { ascending: false })
    .limit(25);

  return (
    <>
      <PageHeader title="Excel imports" description="Update shipment data from the Ocean Master Data Base workbook." />
      <div className="flex flex-col gap-4">
        {can(user.profile.role, "shipments:import") && (
          <Card>
            <CardTitle>New import</CardTitle>
            <ImportUploader userId={user.id} />
          </Card>
        )}

        <Card>
          <CardTitle>Recent imports</CardTitle>
          {!batches?.length ? (
            <EmptyState title="No imports yet" />
          ) : (
            <div className="-mx-4 overflow-x-auto sm:mx-0">
              <table className="w-full min-w-[600px] text-left text-sm">
                <thead className="text-xs uppercase text-muted">
                  <tr>
                    <th scope="col" className="px-4 py-2 sm:px-2">When</th>
                    <th scope="col" className="px-2 py-2">File</th>
                    <th scope="col" className="px-2 py-2">Result</th>
                    <th scope="col" className="px-2 py-2 text-right">Imported</th>
                    <th scope="col" className="px-2 py-2 text-right">Rejected</th>
                  </tr>
                </thead>
                <tbody>
                  {batches.map((b) => (
                    <tr key={b.id} className="border-t border-line">
                      <td className="tabular px-4 py-2 sm:px-2">
                        <Link href={`/imports/${b.id}`} className="text-brand underline-offset-2 hover:underline">
                          {fmtDateTime(b.created_at)}
                        </Link>
                      </td>
                      <td className="max-w-64 truncate px-2 py-2">{b.file_name}</td>
                      <td className="px-2 py-2">
                        <Badge tone={b.status === "completed" ? "success" : b.status === "failed" ? "danger" : "info"}>
                          {b.status}
                        </Badge>
                      </td>
                      <td className="tabular px-2 py-2 text-right">{b.rows_imported} / {b.rows_total}</td>
                      <td className="tabular px-2 py-2 text-right">{b.rows_rejected}</td>
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
