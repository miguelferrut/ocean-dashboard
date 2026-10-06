-- Ocean Control Tower — initial schema
-- Grain: one row in `shipments` per commercial invoice (same grain as Ocean_Traffic_Report / Table1).
-- Containers and BLs are aggregated in views; see docs/database-design.md for the reasoning.

create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------- enums
create type public.app_role as enum ('admin', 'supervisor', 'user');
create type public.invoice_type as enum ('Normal', 'Aluminum', 'Prototype');

-- ---------------------------------------------------------------- profiles
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null,
  full_name   text,
  role        public.app_role not null default 'user',
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Role lookups used by RLS. SECURITY DEFINER so policies on `profiles` do not recurse;
-- the role comes from our table, never from user-editable auth metadata.
create or replace function public.user_role()
returns public.app_role
language sql stable security definer set search_path = ''
as $$
  select p.role from public.profiles p where p.id = (select auth.uid()) and p.is_active
$$;

create or replace function public.has_role(roles public.app_role[])
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(public.user_role() = any (roles), false)
$$;

-- New auth users get a profile with the least-privileged role.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------- settings
create table public.app_settings (
  key         text primary key,
  value       jsonb not null,
  description text,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references public.profiles (id)
);

insert into public.app_settings (key, value, description) values
  ('goal_allowance_days', '{"Normal":7,"Aluminum":12,"Prototype":20}',
   'Days from Effective_Discharge_Date to ETA_SAM_GOAL when the file has no goal'),
  ('targets', '{"customsDays":10,"inlandDays":3,"oceanToleranceDays":1}',
   'Stage targets used by KPIs');

-- ---------------------------------------------------------------- imports
create table public.import_batches (
  id            uuid primary key default gen_random_uuid(),
  file_name     text not null,
  sheet_name    text not null,
  uploaded_by   uuid not null references public.profiles (id),
  status        text not null default 'processing' check (status in ('processing', 'completed', 'failed')),
  rows_total    integer not null default 0,
  rows_imported integer not null default 0,
  rows_rejected integer not null default 0,
  created_at    timestamptz not null default now(),
  finished_at   timestamptz
);

create table public.import_issues (
  id         bigint generated always as identity primary key,
  batch_id   uuid not null references public.import_batches (id) on delete cascade,
  row_number integer not null,
  invoice_no text,
  field      text,
  value      text,
  severity   text not null check (severity in ('error', 'warning')),
  message    text not null
);
create index import_issues_batch_idx on public.import_issues (batch_id);

-- ---------------------------------------------------------------- shipments
create table public.shipments (
  id                         uuid primary key default gen_random_uuid(),
  invoice_no                 text not null,
  bl_no                      text,
  container_no               text,
  asn                        text,

  -- parties / routing
  point_origin               text,
  incoterm                   text,
  forwarder                  text,
  shipping_line              text,
  coordinator                text,          -- Excel "Name"
  plant                      text,
  project                    text,
  material_type              text,          -- Excel "Type Material"
  immex                      text,
  origin_supplier            text,
  invoice_supplier           text,
  broker                     text,
  broker_reference           text,
  terminal                   text,
  carrier                    text,
  vessel                     text,
  voyage_no                  text,
  plant_delivery             text,

  -- commercial
  invoice_total_value        numeric(16, 2) check (invoice_total_value is null or invoice_total_value >= 0),
  currency                   text check (currency is null or currency in ('CNY', 'USD')),
  weight_kg                  numeric(12, 2) check (weight_kg is null or weight_kg >= 0),
  pallets                    integer check (pallets is null or pallets >= 0),
  invoice_type               public.invoice_type not null default 'Normal',

  -- customs
  clave                      text,
  instruccion_especial       text,
  met_val                    text,
  previo                     text,
  china_bl_type              text,
  needs_aaa                  boolean not null default false,
  pedimento_no               text,
  container_seal_no          text,
  modulation_status          text check (modulation_status is null or modulation_status in ('GREEN', 'RED')),
  is_critical                boolean,       -- null = TBD
  cartaporte_id              text,
  gps_link                   text,

  -- milestones (date only; the business works in calendar days)
  file_shipping_date         date,
  atd_port                   date,
  eta_port_by_origin         date,
  eta_port_update            date,
  bl_in_onedrive_date        date,
  instruction_date           date,
  reference_received_date    date,
  aaa_ready_date             date,
  bl_revalidation_date       date,
  proforma_creation_date     date,
  pedimento_approved_date    date,
  pedimento_payment_date     date,
  ata_port                   date,
  vip_date                   date,
  vip_result_date            date,
  effective_discharge_date   date,
  eta_customs_appointment    date,
  customs_release_date       date,
  transport_assignment_date  date,
  impact_date                date,
  eta_sam_goal               date,
  eta_sam_real               date,
  ata_sam                    date,
  sam_discharge_date         date,
  empty_return_date          date,

  -- lineage
  last_import_id             uuid references public.import_batches (id) on delete set null,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now(),
  updated_by                 uuid references public.profiles (id),

  constraint shipments_invoice_no_key unique (invoice_no),
  constraint shipments_invoice_no_format check (invoice_no = upper(btrim(invoice_no)) and invoice_no <> '')
);

-- Exact lookups
create index shipments_bl_idx         on public.shipments (bl_no);
create index shipments_container_idx  on public.shipments (container_no);
-- Partial / "contains" search for the three search modes
create index shipments_invoice_trgm   on public.shipments using gin (invoice_no extensions.gin_trgm_ops);
create index shipments_bl_trgm        on public.shipments using gin (bl_no extensions.gin_trgm_ops);
create index shipments_container_trgm on public.shipments using gin (container_no extensions.gin_trgm_ops);
-- Dashboard date ranges
create index shipments_eta_port_idx   on public.shipments (eta_port_update);
create index shipments_ata_sam_idx    on public.shipments (ata_sam);
create index shipments_release_idx    on public.shipments (customs_release_date);

-- ---------------------------------------------------------------- timestamps
create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger shipments_touch before update on public.shipments
  for each row execute function public.touch_updated_at();
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------- audit
create table public.audit_log (
  id          bigint generated always as identity primary key,
  table_name  text not null,
  record_id   text not null,
  action      text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  old_data    jsonb,
  new_data    jsonb,
  actor_id    uuid,
  created_at  timestamptz not null default now()
);
create index audit_log_record_idx on public.audit_log (table_name, record_id);
create index audit_log_created_idx on public.audit_log (created_at desc);

-- Stores only the changed columns on UPDATE to keep the log small on re-imports.
create or replace function public.audit_row()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  old_j jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  new_j jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  rec_id text := coalesce(coalesce(new_j, old_j) ->> 'id', coalesce(new_j, old_j) ->> 'key');
  diff_old jsonb;
  diff_new jsonb;
begin
  if tg_op = 'UPDATE' then
    select jsonb_object_agg(k, old_j -> k), jsonb_object_agg(k, new_j -> k)
      into diff_old, diff_new
      from jsonb_object_keys(new_j) k
     where k not in ('updated_at', 'last_import_id', 'updated_by')
       and (old_j -> k) is distinct from (new_j -> k);
    if diff_new is null then
      return new;  -- nothing meaningful changed
    end if;
    old_j := diff_old;
    new_j := diff_new;
  end if;

  insert into public.audit_log (table_name, record_id, action, old_data, new_data, actor_id)
  values (tg_table_name, rec_id, tg_op, old_j, new_j, (select auth.uid()));
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger shipments_audit after insert or update or delete on public.shipments
  for each row execute function public.audit_row();
create trigger profiles_audit after insert or update or delete on public.profiles
  for each row execute function public.audit_row();
create trigger settings_audit after insert or update or delete on public.app_settings
  for each row execute function public.audit_row();

-- ---------------------------------------------------------------- derived view
-- Status, goal and FLAGGED depend on "today", so they are computed at read time.
-- Status follows the Excel Status formula (Ocean_Traffic_Report) — see docs/database-design.md.
create or replace view public.shipments_view
with (security_invoker = true)
as
with base as (
  select s.*,
         coalesce(
           s.eta_sam_goal,
           s.effective_discharge_date
             + ((select value from public.app_settings where key = 'goal_allowance_days')
                  ->> s.invoice_type::text)::int
         ) as goal_date
    from public.shipments s
)
select b.*,
  -- Excel formula order, plus the legacy dashboard's guard that a future date is a plan,
  -- not a milestone reached (Excel's ISNUMBER() treats planned dates as done).
  case
    when b.empty_return_date <= current_date then 'Delivered at Sanhua/Empty Return'
    when b.sam_discharge_date <= current_date then 'Delivered at Sanhua'
    when b.customs_release_date = current_date
         and coalesce(b.modulation_status, '') not in ('GREEN', 'RED') then 'In customs'
    when b.customs_release_date <= current_date then 'In transit to Plant'
    when b.effective_discharge_date <= current_date then 'In Port (MX)'
    when b.eta_port_update is not null then 'In transit to port'
    when b.atd_port is null then 'In origin (CH)'
    else 'Review status'
  end as status,
  case
    when b.ata_sam is not null then
      case when b.goal_date is not null and b.ata_sam > b.goal_date then 'DELAYED' else 'ON TIME' end
    when b.goal_date is not null and b.goal_date < current_date then 'DELAYED'
    else 'ON TIME'
  end as flagged,
  case
    when b.effective_discharge_date is null then null
    when b.empty_return_date <= current_date then b.empty_return_date - b.effective_discharge_date
    else current_date - b.effective_discharge_date
  end as days_in_progress
from base b;

-- ---------------------------------------------------------------- RLS
alter table public.profiles       enable row level security;
alter table public.app_settings   enable row level security;
alter table public.import_batches enable row level security;
alter table public.import_issues  enable row level security;
alter table public.shipments      enable row level security;
alter table public.audit_log      enable row level security;

-- profiles: everyone sees their own; admins see and manage all.
create policy profiles_self_read on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.has_role(array['admin']::public.app_role[]));
create policy profiles_admin_update on public.profiles for update to authenticated
  using (public.has_role(array['admin']::public.app_role[]))
  with check (public.has_role(array['admin']::public.app_role[]));

-- Users may edit their own name only — role and is_active are admin-only.
create policy profiles_self_update on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));
create or replace function public.guard_profile_privileges()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (new.role is distinct from old.role or new.is_active is distinct from old.is_active
      or new.email is distinct from old.email)
     and not public.has_role(array['admin']::public.app_role[])
     and (select auth.uid()) is not null then
    raise exception 'Only admins can change role, status or email';
  end if;
  return new;
end;
$$;
create trigger profiles_guard before update on public.profiles
  for each row execute function public.guard_profile_privileges();

-- settings: all active users read, admins write.
create policy settings_read on public.app_settings for select to authenticated
  using (public.user_role() is not null);
create policy settings_admin_write on public.app_settings for all to authenticated
  using (public.has_role(array['admin']::public.app_role[]))
  with check (public.has_role(array['admin']::public.app_role[]));

-- shipments: every active user sees every record (business decision, 2026-10-06);
-- writes (Excel import) are admin/supervisor only. Deletes are admin only.
create policy shipments_read on public.shipments for select to authenticated
  using (public.user_role() is not null);
create policy shipments_insert on public.shipments for insert to authenticated
  with check (public.has_role(array['admin', 'supervisor']::public.app_role[]));
create policy shipments_update on public.shipments for update to authenticated
  using (public.has_role(array['admin', 'supervisor']::public.app_role[]))
  with check (public.has_role(array['admin', 'supervisor']::public.app_role[]));
create policy shipments_delete on public.shipments for delete to authenticated
  using (public.has_role(array['admin']::public.app_role[]));

-- imports
create policy batches_read on public.import_batches for select to authenticated
  using (public.has_role(array['admin', 'supervisor']::public.app_role[]));
create policy batches_insert on public.import_batches for insert to authenticated
  with check (public.has_role(array['admin', 'supervisor']::public.app_role[])
              and uploaded_by = (select auth.uid()));
create policy batches_update on public.import_batches for update to authenticated
  using (uploaded_by = (select auth.uid()))
  with check (uploaded_by = (select auth.uid()));
create policy issues_read on public.import_issues for select to authenticated
  using (public.has_role(array['admin', 'supervisor']::public.app_role[]));
create policy issues_insert on public.import_issues for insert to authenticated
  with check (exists (select 1 from public.import_batches b
                       where b.id = batch_id and b.uploaded_by = (select auth.uid())));

-- audit: read-only for admins; rows are written only by the SECURITY DEFINER trigger.
create policy audit_admin_read on public.audit_log for select to authenticated
  using (public.has_role(array['admin']::public.app_role[]));

-- Functions are not callable by anonymous visitors.
revoke execute on function public.user_role() from anon, public;
revoke execute on function public.has_role(public.app_role[]) from anon, public;
revoke execute on function public.handle_new_user() from anon, authenticated, public;
revoke execute on function public.audit_row() from anon, authenticated, public;
grant execute on function public.user_role() to authenticated;
grant execute on function public.has_role(public.app_role[]) to authenticated;
