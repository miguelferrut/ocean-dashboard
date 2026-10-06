import { redirect } from "next/navigation";
import { AppShell, type NavItem } from "@/components/app-shell";
import { can, ROLE_LABELS, type Permission } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/session";

const NAV: (NavItem & { permission: Permission })[] = [
  { href: "/dashboard", label: "Dashboard", permission: "dashboard:view" },
  { href: "/shipments", label: "Shipments", permission: "shipments:view" },
  { href: "/imports", label: "Excel imports", permission: "imports:view" },
  { href: "/admin/users", label: "Users", permission: "users:manage" },
  { href: "/admin/settings", label: "Settings", permission: "settings:manage" },
];

// Every page under (app) needs a signed-in, active user. Pages add their own permission check.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.profile.is_active) redirect("/inactive");

  const nav = NAV.filter((n) => can(user.profile.role, n.permission)).map(({ href, label }) => ({ href, label }));
  return (
    <AppShell nav={nav} userLabel={user.profile.full_name || user.email} roleLabel={ROLE_LABELS[user.profile.role]}>
      {children}
    </AppShell>
  );
}
