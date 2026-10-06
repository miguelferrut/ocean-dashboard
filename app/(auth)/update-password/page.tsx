import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { UpdatePasswordForm } from "@/components/auth-forms";
import { getCurrentUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "New password" };

// Reached from an invite or reset email: the link handler has already signed the user in.
export default async function UpdatePasswordPage() {
  if (!(await getCurrentUser())) redirect("/login?error=link_invalid");
  return <UpdatePasswordForm />;
}
