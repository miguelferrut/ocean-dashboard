"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/env";

export type FormState = { error?: string; message?: string } | undefined;

// Only allow internal redirect targets after login (prevents open redirects via ?next=).
function safeNext(next: FormDataEntryValue | null) {
  const s = typeof next === "string" ? next : "";
  return s.startsWith("/") && !s.startsWith("//") ? s : "/dashboard";
}

const credentials = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
});

export async function signIn(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = credentials.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  // Same message for unknown email and wrong password, so accounts can't be enumerated.
  if (error) return { error: "Email or password is incorrect." };

  redirect(safeNext(formData.get("next")));
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function requestPasswordReset(_: FormState, formData: FormData): Promise<FormState> {
  const email = z.string().trim().toLowerCase().email().safeParse(formData.get("email"));
  if (!email.success) return { error: "Enter a valid email address" };

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email.data, {
    redirectTo: `${siteUrl()}/auth/callback?next=/update-password`,
  });
  // Always the same answer, whether or not the address has an account.
  return { message: "If that address has an account, a reset link is on its way. Check your inbox." };
}

const newPassword = z
  .object({
    password: z
      .string()
      .min(10, "Use at least 10 characters")
      .regex(/[A-Za-z]/, "Include a letter")
      .regex(/[0-9]/, "Include a number"),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { message: "Passwords don't match", path: ["confirm"] });

export async function updatePassword(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = newPassword.safeParse({ password: formData.get("password"), confirm: formData.get("confirm") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: error.message };
  redirect("/dashboard?passwordUpdated=1");
}
