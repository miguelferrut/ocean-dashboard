import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { can, type Permission } from "@/lib/auth/permissions";
import type { ProfileRow } from "@/types/database.types";

export type CurrentUser = { id: string; email: string; profile: ProfileRow };

// Cached per request so layouts and pages share one Auth + profile lookup.
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (!profile) return null;
  return { id: user.id, email: user.email ?? profile.email, profile };
});

// Use at the top of every protected page and server action.
export async function requirePermission(permission: Permission): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.profile.is_active) redirect("/inactive");
  if (!can(user.profile.role, permission)) redirect("/dashboard?denied=1");
  return user;
}

// Variant for server actions that should return an error instead of redirecting.
export async function checkPermission(
  permission: Permission,
): Promise<{ ok: true; user: CurrentUser } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Your session has expired. Sign in again." };
  if (!user.profile.is_active) return { ok: false, error: "Your account is not active." };
  if (!can(user.profile.role, permission)) return { ok: false, error: "You don't have permission to do this." };
  return { ok: true, user };
}
