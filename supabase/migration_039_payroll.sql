-- เงินเดือน (payroll): an employees master list + one entry per employee
-- per month, matching the company's existing paper "ใบจ่ายเงินเดือน/ค่าแรง"
-- slip layout. Admin-only (owner/manager) throughout — individual salary
-- data is far more sensitive than the rest of Expenses, which also allows
-- the account role.
create table employees (
  id uuid primary key default gen_random_uuid(),
  employee_code text not null unique,
  full_name text not null,
  position text,
  id_card_no text,
  start_date date,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table employees enable row level security;

create policy employees_select on employees for select
  using (my_role() in ('owner', 'manager'));
create policy employees_write on employees for all
  using (my_role() in ('owner', 'manager')) with check (my_role() in ('owner', 'manager'));

create table payroll_entries (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  -- Always the 1st of the paid-for month (e.g. 2026-01-01) — display uses
  -- the month/year, the day is just a fixed anchor for date math/sorting.
  pay_period date not null,
  pay_date date,
  base_salary numeric(14,2) not null default 0,
  fuel_allowance numeric(14,2) not null default 0,
  commission numeric(14,2) not null default 0,
  incentive numeric(14,2) not null default 0,
  social_security numeric(14,2) not null default 0,
  withholding_tax numeric(14,2) not null default 0,
  other_deductions numeric(14,2) not null default 0,
  total_income numeric(14,2) generated always as (base_salary + fuel_allowance + commission + incentive) stored,
  total_deductions numeric(14,2) generated always as (social_security + withholding_tax + other_deductions) stored,
  net_salary numeric(14,2) generated always as (
    base_salary + fuel_allowance + commission + incentive - social_security - withholding_tax - other_deductions
  ) stored,
  note text,
  prepared_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  unique (employee_id, pay_period)
);
alter table payroll_entries enable row level security;

create policy payroll_entries_select on payroll_entries for select
  using (my_role() in ('owner', 'manager'));
create policy payroll_entries_write on payroll_entries for all
  using (my_role() in ('owner', 'manager')) with check (my_role() in ('owner', 'manager'));
