alter table profiles
  add column department text,
  add column active boolean not null default true;

-- profiles previously had no update policy at all; only owner may edit anyone's row
-- (view/edit-role only — no service-role key, no account creation, no password reset).
create policy profiles_update on profiles for update
  using (my_role() = 'owner') with check (my_role() = 'owner');

-- Exposes auth.users email without the service-role key or auth.admin.* APIs —
-- runs inside Postgres as security definer, gated to owner internally, same
-- proven shape as record_stock_movement's role check.
create function get_user_emails()
returns table(id uuid, email text)
language plpgsql security definer as $$
begin
  if my_role() <> 'owner' then
    raise exception 'permission denied';
  end if;
  return query select au.id, au.email::text from auth.users au;
end;
$$;
