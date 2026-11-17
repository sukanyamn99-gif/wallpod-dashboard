-- สิทธิ์ "อ่านอย่างเดียว" (role = 'viewer'): sees everything the owner sees and
-- can change nothing.
--
--  1. profiles.role accepts 'viewer'.
--  2. my_role() reports a viewer as 'owner', so every existing SELECT policy
--     that lets the owner read lets the viewer read too.
--  3. A guard trigger on every public table refuses INSERT / UPDATE / DELETE /
--     TRUNCATE for a viewer — including writes made inside security-definer
--     functions — so nothing the owner's policies would otherwise allow gets
--     through. login_log stays writable (signing in records a row).
--  4. Storage uploads / replacements / deletions are refused for a viewer too.
--
-- A table created after this migration needs the same trigger (see the DO block).

do $$
declare c text;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.profiles'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%role%'
  loop
    execute format('alter table public.profiles drop constraint %I', c);
  end loop;
end
$$;

alter table profiles add constraint profiles_role_check check (role in
  ('owner','manager','sales','design','support_sale','account','foreman','production','viewer'));

create or replace function my_role() returns text
language sql security definer stable as $$
  select case when role = 'viewer' then 'owner' else role end
  from profiles where id = auth.uid()
$$;

create or replace function block_readonly_writes() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from profiles where id = auth.uid() and role = 'viewer') then
    raise exception 'บัญชีนี้เป็นสิทธิ์อ่านอย่างเดียว ไม่สามารถเพิ่ม แก้ไข หรือลบข้อมูลได้'
      using errcode = '42501';
  end if;
  return null;
end
$$;

do $$
declare t text;
begin
  for t in
    select tablename from pg_tables
    where schemaname = 'public' and tablename <> 'login_log'
  loop
    begin
      execute format('drop trigger if exists readonly_guard on public.%I', t);
      execute format(
        'create trigger readonly_guard before insert or update or delete or truncate on public.%I
           for each statement execute function block_readonly_writes()', t);
    exception when others then
      raise notice 'guard skipped for %: %', t, sqlerrm;
    end;
  end loop;
end
$$;

do $$
begin
  drop policy if exists readonly_no_storage_insert on storage.objects;
  drop policy if exists readonly_no_storage_update on storage.objects;
  drop policy if exists readonly_no_storage_delete on storage.objects;
  create policy readonly_no_storage_insert on storage.objects as restrictive for insert
    with check (not exists (select 1 from profiles where id = auth.uid() and role = 'viewer'));
  create policy readonly_no_storage_update on storage.objects as restrictive for update
    using (not exists (select 1 from profiles where id = auth.uid() and role = 'viewer'));
  create policy readonly_no_storage_delete on storage.objects as restrictive for delete
    using (not exists (select 1 from profiles where id = auth.uid() and role = 'viewer'));
exception when others then
  raise notice 'storage policies skipped: %', sqlerrm;
end
$$;
