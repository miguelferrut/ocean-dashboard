import type { Metadata } from "next";
import { InviteUserForm, UserRowForm } from "@/components/admin-forms";
import { Badge, Card, CardTitle, PageHeader } from "@/components/ui";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import { fmtDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Users" };

export default async function UsersPage() {
  const me = await requirePermission("users:manage");
  const supabase = await createClient();
  const { data: users } = await supabase
    .from("profiles")
    .select("id,email,full_name,role,is_active,created_at")
    .order("is_active", { ascending: false })
    .order("email");

  return (
    <>
      <PageHeader title="Users" description="Invite people, set their role, and disable access." />
      <div className="flex flex-col gap-4">
        <Card>
          <CardTitle>Invite a user</CardTitle>
          <InviteUserForm />
        </Card>
        <Card>
          <CardTitle>All users ({users?.length ?? 0})</CardTitle>
          <div className="-mx-4 overflow-x-auto sm:mx-0">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="text-xs uppercase text-muted">
                <tr>
                  <th scope="col" className="px-4 py-2 sm:px-2">User</th>
                  <th scope="col" className="px-2 py-2">Current</th>
                  <th scope="col" className="px-2 py-2">Since</th>
                  <th scope="col" className="px-2 py-2">Change</th>
                </tr>
              </thead>
              <tbody>
                {users?.map((u) => (
                  <tr key={u.id} className="border-t border-line align-middle">
                    <td className="px-4 py-2 sm:px-2">
                      <span className="block font-semibold">{u.full_name || u.email}</span>
                      {u.full_name && <span className="block text-xs text-muted">{u.email}</span>}
                    </td>
                    <td className="px-2 py-2">
                      <span className="flex flex-wrap gap-1">
                        <Badge>{ROLE_LABELS[u.role]}</Badge>
                        {!u.is_active && <Badge tone="danger">Disabled</Badge>}
                      </span>
                    </td>
                    <td className="tabular px-2 py-2">{fmtDate(u.created_at.slice(0, 10))}</td>
                    <td className="px-2 py-2">
                      <UserRowForm userId={u.id} role={u.role} isActive={u.is_active} isSelf={u.id === me.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  );
}
