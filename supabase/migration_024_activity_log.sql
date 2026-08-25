-- ============ Significant-action activity log ============
-- Separate from login_log (who logged in when) — this tracks who did
-- something risky (delete, permission change, account change) and what.
-- Append-only: no update/delete policy, same shape as login_log/
-- sales_lead_change_log. Insert restricted to logging your own action,
-- select restricted to owner.

create table activity_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references profiles(id) on delete set null,
  actor_name_snapshot text not null,
  action text not null,
  entity_label text,
  created_at timestamptz not null default now()
);

alter table activity_log enable row level security;

create policy activity_log_select on activity_log for select
  using (my_role() = 'owner');

create policy activity_log_insert on activity_log for insert
  with check (actor_id = auth.uid());
