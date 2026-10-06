import type { AppRole } from "@/types/database.types";

// Single map of what each role can do in the UI and server actions.
// RLS in Postgres enforces the same rules for data; this map decides navigation and early rejects.
export const PERMISSIONS = {
  "dashboard:view": ["admin", "supervisor", "user"],
  "shipments:view": ["admin", "supervisor", "user"],
  "shipments:import": ["admin", "supervisor"],
  "imports:view": ["admin", "supervisor"],
  "users:manage": ["admin"],
  "settings:manage": ["admin"],
} as const satisfies Record<string, readonly AppRole[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: AppRole | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  return (PERMISSIONS[permission] as readonly AppRole[]).includes(role);
}

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Admin",
  supervisor: "Supervisor",
  user: "User",
};
