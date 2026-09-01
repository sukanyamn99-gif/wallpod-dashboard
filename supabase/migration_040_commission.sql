-- คำนวณค่าคอมมิชชั่น: a rate-tier lookup table (discount % given to the
-- customer -> commission % paid to the broker/sales rep who closed the
-- deal) plus one row per commissionable sale. Same admin+account tier as
-- the rest of Expenses (unlike เงินเดือน, which is admin-only) since
-- commission payouts are operational, not individual-salary-sensitive.
create table commission_rate_tiers (
  id uuid primary key default gen_random_uuid(),
  discount_percent numeric(5,2) not null unique,
  commission_rate_percent numeric(5,2) not null,
  created_at timestamptz not null default now()
);
alter table commission_rate_tiers enable row level security;

create policy commission_rate_tiers_select on commission_rate_tiers for select
  using (my_role() in ('owner', 'manager', 'account'));
create policy commission_rate_tiers_write on commission_rate_tiers for all
  using (my_role() in ('owner', 'manager')) with check (my_role() in ('owner', 'manager'));

insert into commission_rate_tiers (discount_percent, commission_rate_percent) values
  (0, 4.50), (5, 4.25), (10, 4.00), (15, 3.00), (20, 2.50), (25, 2.00), (30, 1.50), (40, 1.00);

create table commission_entries (
  id uuid primary key default gen_random_uuid(),
  entry_date date not null,
  job_no text,
  project_title text not null,
  project_name text,
  broker_name text not null,
  amount numeric(14,2) not null default 0,
  -- Standard 7% VAT, matching how every other document in this app derives
  -- it — stored (not just computed in the UI) so the report/print totals
  -- never drift from what the entry actually recorded.
  amount_incl_vat numeric(14,2) generated always as (round(amount * 1.07, 2)) stored,
  discount_percent numeric(5,2) not null default 0,
  -- Looked up from commission_rate_tiers at entry time and snapshotted here
  -- (editable/overridable) rather than joined live, so a later change to
  -- the rate table never silently rewrites the commission on a past sale.
  commission_rate_percent numeric(5,2) not null default 0,
  commission_amount numeric(14,2) generated always as (round(amount * commission_rate_percent / 100, 2)) stored,
  installment_label text,
  paid_amount numeric(14,2),
  invoice_no text,
  receipt_no text,
  received_date date,
  note text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
alter table commission_entries enable row level security;

create policy commission_entries_select on commission_entries for select
  using (my_role() in ('owner', 'manager', 'account'));
create policy commission_entries_write on commission_entries for all
  using (my_role() in ('owner', 'manager')) with check (my_role() in ('owner', 'manager'));
