alter table payroll_entries add column ot_pay numeric(14,2) not null default 0;

-- total_income/net_salary are generated columns — Postgres has no ALTER for
-- a generated expression, so they're dropped and re-added with ot_pay folded
-- into the same formula (total_deductions is untouched, OT is income only).
alter table payroll_entries drop column total_income;
alter table payroll_entries drop column net_salary;

alter table payroll_entries
  add column total_income numeric(14,2) generated always as (
    base_salary + fuel_allowance + commission + incentive + ot_pay
  ) stored;
alter table payroll_entries
  add column net_salary numeric(14,2) generated always as (
    base_salary + fuel_allowance + commission + incentive + ot_pay - social_security - withholding_tax - other_deductions
  ) stored;
