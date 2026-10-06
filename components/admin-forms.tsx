"use client";

import { useActionState } from "react";
import { inviteUser, updateSettings, updateUser } from "@/app/(app)/admin/actions";
import { Alert, Button, Field, Input, Select } from "@/components/ui";
import type { AppRole } from "@/types/database.types";

const ROLE_OPTIONS: { value: AppRole; label: string }[] = [
  { value: "user", label: "User — view dashboards and shipments" },
  { value: "supervisor", label: "Supervisor — also imports Excel" },
  { value: "admin", label: "Admin — also manages users and settings" },
];

export function InviteUserForm() {
  const [state, action, pending] = useActionState(inviteUser, undefined);
  return (
    <form action={action} className="grid gap-3 md:grid-cols-[2fr_2fr_2fr_auto] md:items-end">
      <Field label="Email" htmlFor="invite-email">
        <Input id="invite-email" name="email" type="email" required autoComplete="off" />
      </Field>
      <Field label="Full name" htmlFor="invite-name">
        <Input id="invite-name" name="fullName" autoComplete="off" />
      </Field>
      <Field label="Role" htmlFor="invite-role">
        <Select id="invite-role" name="role" defaultValue="user">
          {ROLE_OPTIONS.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </Select>
      </Field>
      <Button type="submit" disabled={pending}>{pending ? "Sending…" : "Send invite"}</Button>
      <div className="md:col-span-4" aria-live="polite">
        {state?.error && <Alert tone="error">{state.error}</Alert>}
        {state?.message && <Alert tone="success">{state.message}</Alert>}
      </div>
    </form>
  );
}

export function UserRowForm({
  userId,
  role,
  isActive,
  isSelf,
}: {
  userId: string;
  role: AppRole;
  isActive: boolean;
  isSelf: boolean;
}) {
  const [state, action, pending] = useActionState(updateUser, undefined);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="userId" value={userId} />
      <label className="sr-only" htmlFor={`role-${userId}`}>Role</label>
      <select
        id={`role-${userId}`}
        name="role"
        defaultValue={role}
        disabled={isSelf}
        className="min-h-9 rounded-md border border-line bg-surface px-2 text-sm"
      >
        <option value="user">User</option>
        <option value="supervisor">Supervisor</option>
        <option value="admin">Admin</option>
      </select>
      <label className="sr-only" htmlFor={`active-${userId}`}>Status</label>
      <select
        id={`active-${userId}`}
        name="isActive"
        defaultValue={String(isActive)}
        disabled={isSelf}
        className="min-h-9 rounded-md border border-line bg-surface px-2 text-sm"
      >
        <option value="true">Active</option>
        <option value="false">Disabled</option>
      </select>
      {isSelf && (
        <>
          <input type="hidden" name="role" value={role} />
          <input type="hidden" name="isActive" value="true" />
        </>
      )}
      {!isSelf && (
        <button type="submit" disabled={pending} className="min-h-9 rounded-md border border-line px-3 text-sm font-semibold hover:bg-surface-2">
          {pending ? "Saving…" : "Save"}
        </button>
      )}
      <span aria-live="polite" className="text-xs">
        {state?.error && <span className="text-red">{state.error}</span>}
        {state?.message && <span className="text-green">{state.message}</span>}
      </span>
    </form>
  );
}

export function SettingsForm({
  allowance,
  targets,
}: {
  allowance: { Normal: number; Aluminum: number; Prototype: number };
  targets: { customsDays: number; inlandDays: number };
}) {
  const [state, action, pending] = useActionState(updateSettings, undefined);
  return (
    <form action={action} className="flex flex-col gap-4">
      <fieldset className="grid gap-3 sm:grid-cols-3">
        <legend className="mb-2 text-sm text-muted">
          Days from container discharge to the ETA SAM goal, used when the workbook has no ETA_SAM_GOAL.
        </legend>
        <Field label="Normal" htmlFor="normal">
          <Input id="normal" name="normal" type="number" min={0} max={120} defaultValue={allowance.Normal} required />
        </Field>
        <Field label="Aluminum" htmlFor="aluminum">
          <Input id="aluminum" name="aluminum" type="number" min={0} max={120} defaultValue={allowance.Aluminum} required />
        </Field>
        <Field label="Prototype" htmlFor="prototype">
          <Input id="prototype" name="prototype" type="number" min={0} max={120} defaultValue={allowance.Prototype} required />
        </Field>
      </fieldset>
      <fieldset className="grid gap-3 sm:grid-cols-3">
        <legend className="mb-2 text-sm text-muted">Stage targets used by dashboard KPIs.</legend>
        <Field label="Port → customs release (days)" htmlFor="customsDays">
          <Input id="customsDays" name="customsDays" type="number" min={1} max={60} defaultValue={targets.customsDays} required />
        </Field>
        <Field label="Release → SAM (days)" htmlFor="inlandDays">
          <Input id="inlandDays" name="inlandDays" type="number" min={1} max={60} defaultValue={targets.inlandDays} required />
        </Field>
      </fieldset>
      <div>
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save settings"}</Button>
      </div>
      <div aria-live="polite">
        {state?.error && <Alert tone="error">{state.error}</Alert>}
        {state?.message && <Alert tone="success">{state.message}</Alert>}
      </div>
    </form>
  );
}
