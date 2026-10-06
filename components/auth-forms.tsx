"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestPasswordReset, signIn, updatePassword } from "@/app/(auth)/actions";
import { Alert, Button, Field, Input } from "@/components/ui";

export function LoginForm({ next, notice }: { next?: string; notice?: string }) {
  const [state, action, pending] = useActionState(signIn, undefined);
  return (
    <form action={action} className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">Sign in</h1>
      {notice && <Alert>{notice}</Alert>}
      {state?.error && <Alert tone="error">{state.error}</Alert>}
      <input type="hidden" name="next" value={next ?? ""} />
      <Field label="Email" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" required autoFocus />
      </Field>
      <Field label="Password" htmlFor="password">
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </Field>
      <Button type="submit" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
      <Link href="/forgot-password" className="text-center text-sm text-brand underline-offset-2 hover:underline">
        Forgot your password?
      </Link>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, undefined);
  return (
    <form action={action} className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">Reset your password</h1>
      <p className="text-sm text-muted">We&apos;ll email you a link to choose a new password.</p>
      {state?.error && <Alert tone="error">{state.error}</Alert>}
      {state?.message && <Alert tone="success">{state.message}</Alert>}
      <Field label="Email" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" required autoFocus />
      </Field>
      <Button type="submit" disabled={pending}>
        {pending ? "Sending…" : "Send reset link"}
      </Button>
      <Link href="/login" className="text-center text-sm text-brand underline-offset-2 hover:underline">
        Back to sign in
      </Link>
    </form>
  );
}

export function UpdatePasswordForm() {
  const [state, action, pending] = useActionState(updatePassword, undefined);
  return (
    <form action={action} className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">Choose a new password</h1>
      {state?.error && <Alert tone="error">{state.error}</Alert>}
      <Field label="New password" htmlFor="password" hint="At least 10 characters, with a letter and a number.">
        <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={10} />
      </Field>
      <Field label="Confirm password" htmlFor="confirm">
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required />
      </Field>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save password"}
      </Button>
    </form>
  );
}
