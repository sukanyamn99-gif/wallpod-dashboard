-- Redesigns commission_entries to link directly to a real WALLPOD Project
-- Sales job instead of duplicating job_no/customer/amount as free-text —
-- the user wants commission rows auto-pulled from Koonway Project Sales
-- (grouped by month/sales rep), with the only manual input being the
-- discount % per job. No real rows existed under the old shape, so this
-- is a clean drop + recreate rather than a column-by-column migration.
drop table if exists commission_entries;

create table commission_entries (
  id uuid primary key default gen_random_uuid(),
  -- One commission row per fully-collected project — "เอาเฉพาะ Project ที่
  -- เก็บเงินเรียบร้อยแล้ว" — so amount is the project's own pre_vat total,
  -- not a per-installment fragment.
  project_id uuid not null unique references projects(id) on delete cascade,
  discount_percent numeric(5,2) not null default 0,
  -- Looked up from commission_rate_tiers when discount_percent is saved
  -- (editable/overridable) rather than joined live, so a later change to
  -- the rate table never silently rewrites a job's already-paid commission.
  commission_rate_percent numeric(5,2) not null default 0,
  commission_amount numeric(14,2) not null default 0,
  note text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
alter table commission_entries enable row level security;

create policy commission_entries_select on commission_entries for select
  using (my_role() in ('owner', 'manager', 'account'));
create policy commission_entries_write on commission_entries for all
  using (my_role() in ('owner', 'manager')) with check (my_role() in ('owner', 'manager'));
