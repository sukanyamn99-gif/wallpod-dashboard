-- ============ Login activity log (เก็บ log การใช้งาน) ============
-- Append-only: no update/delete policy, matching sales_lead_change_log's
-- precedent — insert restricted to logging your own login, select
-- restricted to owner (this is who-logged-in-when, sensitive to the same
-- degree as the ผู้ใช้งาน page it now sits next to in the sidebar).

create table login_log (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id) on delete set null,
  full_name_snapshot text not null,
  email text,
  logged_in_at timestamptz not null default now()
);

alter table login_log enable row level security;

create policy login_log_select on login_log for select
  using (my_role() = 'owner');

create policy login_log_insert on login_log for insert
  with check (profile_id = auth.uid());
