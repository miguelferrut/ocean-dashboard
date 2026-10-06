"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { siteUrl } from "@/lib/env";
import { checkPermission } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type ActionState = { error?: string; message?: string } | undefined;

const ROLE = z.enum(["admin", "supervisor", "user"]);

const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  fullName: z.string().trim().max(120).optional(),
  role: ROLE,
});

export async function inviteUser(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await checkPermission("users:manage");
  if (!auth.ok) return { error: auth.error };
  const parsed = inviteSchema.safeParse({
    email: formData.get("email"),
    fullName: formData.get("fullName") || undefined,
    role: formData.get("role"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  // Service-role client is used only for the Auth admin API, after the admin check above.
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.inviteUserByEmail(parsed.data.email, {
    data: { full_name: parsed.data.fullName ?? null },
    redirectTo: `${siteUrl()}/auth/confirm?next=/update-password`,
  });
  if (error || !data.user) return { error: error?.message ?? "Could not send the invite." };

  // The profile row is created inactive by a trigger; the admin's own session activates it,
  // so the change is attributed to them in the audit log.
  const supabase = await createClient();
  const { error: profileError } = await supabase
    .from("profiles")
    .update({ role: parsed.data.role, is_active: true, full_name: parsed.data.fullName ?? null })
    .eq("id", data.user.id);
  if (profileError) return { error: `Invite sent, but setting the role failed: ${profileError.message}` };

  revalidatePath("/admin/users");
  return { message: `Invitation sent to ${parsed.data.email}.` };
}

const updateSchema = z.object({ userId: z.string().uuid(), role: ROLE, isActive: z.enum(["true", "false"]) });

export async function updateUser(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await checkPermission("users:manage");
  if (!auth.ok) return { error: auth.error };
  const parsed = updateSchema.safeParse({
    userId: formData.get("userId"),
    role: formData.get("role"),
    isActive: formData.get("isActive"),
  });
  if (!parsed.success) return { error: "Invalid request." };
  const { userId, role } = parsed.data;
  const isActive = parsed.data.isActive === "true";

  if (userId === auth.user.id && (role !== "admin" || !isActive)) {
    return { error: "You can't remove your own admin access. Ask another admin." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ role, is_active: isActive }).eq("id", userId);
  if (error) return { error: error.message };

  // Also block sign-in at the Auth layer for disabled users (RLS already denies them data).
  const admin = createAdminClient();
  await admin.auth.admin.updateUserById(userId, { ban_duration: isActive ? "none" : "876000h" });

  revalidatePath("/admin/users");
  return { message: "Saved." };
}

const settingsSchema = z.object({
  normal: z.coerce.number().int().min(0).max(120),
  aluminum: z.coerce.number().int().min(0).max(120),
  prototype: z.coerce.number().int().min(0).max(120),
  customsDays: z.coerce.number().int().min(1).max(60),
  inlandDays: z.coerce.number().int().min(1).max(60),
});

export async function updateSettings(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await checkPermission("settings:manage");
  if (!auth.ok) return { error: auth.error };
  const parsed = settingsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Enter whole numbers of days within the allowed range." };
  const s = parsed.data;

  const supabase = await createClient();
  const now = new Date().toISOString();
  const { error } = await supabase.from("app_settings").upsert([
    {
      key: "goal_allowance_days",
      value: { Normal: s.normal, Aluminum: s.aluminum, Prototype: s.prototype },
      updated_at: now,
      updated_by: auth.user.id,
    },
    {
      key: "targets",
      value: { customsDays: s.customsDays, inlandDays: s.inlandDays, oceanToleranceDays: 1 },
      updated_at: now,
      updated_by: auth.user.id,
    },
  ]);
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { message: "Settings saved." };
}
