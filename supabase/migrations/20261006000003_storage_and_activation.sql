-- 1. Defense in depth: an account is inactive until an admin activates it, so even if
--    public sign-up is accidentally left on, a self-registered user can read nothing.
alter table public.profiles alter column is_active set default false;

-- 2. Private bucket for uploaded workbooks (keeps the original file of every import).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('imports', 'imports', false, 52428800,
        array['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
on conflict (id) do nothing;

-- Admin/supervisor may upload into a folder named after their own user id and read back files.
create policy imports_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'imports'
              and (storage.foldername(name))[1] = (select auth.uid())::text
              and (select private.has_role(array['admin', 'supervisor']::public.app_role[])));
create policy imports_read on storage.objects for select to authenticated
  using (bucket_id = 'imports'
         and (select private.has_role(array['admin', 'supervisor']::public.app_role[])));
