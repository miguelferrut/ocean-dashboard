-- Advisor fixes: keep SECURITY DEFINER helpers out of the exposed `public` API schema,
-- and index foreign keys.

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

alter function public.user_role() set schema private;
alter function public.has_role(public.app_role[]) set schema private;
alter function public.guard_profile_privileges() set schema private;
alter function public.handle_new_user() set schema private;
alter function public.audit_row() set schema private;

-- Function bodies reference each other by schema-qualified name; re-point them.
create or replace function private.has_role(roles public.app_role[])
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(private.user_role() = any (roles), false)
$$;

create or replace function private.guard_profile_privileges()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (new.role is distinct from old.role or new.is_active is distinct from old.is_active
      or new.email is distinct from old.email)
     and not private.has_role(array['admin']::public.app_role[])
     and (select auth.uid()) is not null then
    raise exception 'Only admins can change role, status or email';
  end if;
  return new;
end;
$$;

revoke execute on all functions in schema private from public, anon;
revoke execute on function private.guard_profile_privileges(), private.handle_new_user(), private.audit_row()
  from authenticated;
grant execute on function private.user_role(), private.has_role(public.app_role[]) to authenticated;

-- Exposed, read-only accessor for the UI (SECURITY INVOKER: it only returns the caller's own role).
create or replace function public.my_role()
returns public.app_role
language sql stable security invoker set search_path = ''
as $$ select private.user_role() $$;
revoke execute on function public.my_role() from public, anon;
grant execute on function public.my_role() to authenticated;

-- FK indexes
create index if not exists app_settings_updated_by_idx on public.app_settings (updated_by);
create index if not exists import_batches_uploaded_by_idx on public.import_batches (uploaded_by);
create index if not exists shipments_last_import_idx on public.shipments (last_import_id);
create index if not exists shipments_updated_by_idx on public.shipments (updated_by);

-- Note: existing RLS policies reference these helpers by OID, so after the schema move
-- they call private.user_role()/private.has_role() without being recreated.
