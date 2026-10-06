-- Manual RLS regression checks. Each block runs in a transaction and rolls back, so it is
-- safe on any environment. Run each block separately in the SQL editor; expected results
-- are in the comments. (Verified against production on 2026-10-06.)

-- 1. A new account is inactive and sees nothing.        expect: 0 rows, role null
begin;
insert into auth.users (id, email, aud, role, instance_id) values ('00000000-0000-0000-0000-0000000000a1','u@test.local','authenticated','authenticated','00000000-0000-0000-0000-000000000000');
insert into public.shipments (invoice_no) values ('TEST-INV-1');
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}',true);
set local role authenticated;
select count(*) as visible_rows, public.my_role() as role from public.shipments;
rollback;

-- 2. An active user reads everything but changes nothing except their own name.
--    expect: rows 1, profiles 1, audit 0, settings 0, shipments 0, own name 1
begin;
insert into auth.users (id, email, aud, role, instance_id) values ('00000000-0000-0000-0000-0000000000a1','u@test.local','authenticated','authenticated','00000000-0000-0000-0000-000000000000');
update public.profiles set is_active = true where id = '00000000-0000-0000-0000-0000000000a1';
insert into public.shipments (invoice_no) values ('TEST-INV-1');
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}',true);
set local role authenticated;
create temp table r(t text, v text);
insert into r select 'rows', count(*)::text from public.shipments;
insert into r select 'profiles', count(*)::text from public.profiles;
insert into r select 'audit', count(*)::text from public.audit_log;
with u as (update public.app_settings set value='{}' returning 1) insert into r select 'settings updated', count(*)::text from u;
with u as (update public.shipments set bl_no='X' returning 1) insert into r select 'shipments updated', count(*)::text from u;
with u as (update public.profiles set full_name='Me' returning 1) insert into r select 'own name updated', count(*)::text from u;
select * from r;
rollback;

-- 3. A user cannot insert shipments.                     expect: ERROR 42501 row-level security
begin;
insert into auth.users (id, email, aud, role, instance_id) values ('00000000-0000-0000-0000-0000000000a1','u@test.local','authenticated','authenticated','00000000-0000-0000-0000-000000000000');
update public.profiles set is_active = true where id = '00000000-0000-0000-0000-0000000000a1';
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}',true);
set local role authenticated;
insert into public.shipments (invoice_no) values ('TEST-INV-2');
rollback;

-- 4. A user cannot promote themselves.                   expect: ERROR Only admins can change role, status or email
begin;
insert into auth.users (id, email, aud, role, instance_id) values ('00000000-0000-0000-0000-0000000000a1','u@test.local','authenticated','authenticated','00000000-0000-0000-0000-000000000000');
update public.profiles set is_active = true where id = '00000000-0000-0000-0000-0000000000a1';
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}',true);
set local role authenticated;
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000000a1';
rollback;

-- 5. A supervisor imports (upserts) but cannot delete; changes are audited with the actor.
--    expect: upsert 1, deleted 0, audit visible 0, audit rows 2 with actor = ...b2
begin;
insert into auth.users (id, email, aud, role, instance_id) values ('00000000-0000-0000-0000-0000000000b2','s@test.local','authenticated','authenticated','00000000-0000-0000-0000-000000000000');
update public.profiles set is_active = true, role = 'supervisor' where id = '00000000-0000-0000-0000-0000000000b2';
insert into public.shipments (invoice_no) values ('TEST-INV-1');
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}',true);
set local role authenticated;
create temp table r(t text, v text);
with i as (insert into public.shipments(invoice_no, bl_no) values ('TEST-INV-2','B') on conflict (invoice_no) do update set bl_no = excluded.bl_no returning 1) insert into r select 'upsert', count(*)::text from i;
with d as (delete from public.shipments where invoice_no='TEST-INV-1' returning 1) insert into r select 'deleted', count(*)::text from d;
insert into r select 'audit visible', count(*)::text from public.audit_log;
reset role;
insert into r select 'audit rows', count(*)::text || ' / actor=' || coalesce(max(actor_id::text),'null') from public.audit_log where table_name='shipments';
select * from r;
rollback;
