import type { Metadata } from "next";
import { LoginForm } from "@/components/auth-forms";

export const metadata: Metadata = { title: "Sign in" };

const NOTICES: Record<string, string> = {
  link_invalid: "That link has expired or was already used. Request a new one.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  return <LoginForm next={next} notice={error ? NOTICES[error] : undefined} />;
}
