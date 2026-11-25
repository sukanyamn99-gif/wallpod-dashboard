-- 1) Standing monthly salary per employee, so the payroll entry form can
--    pre-fill the เงินเดือน box as soon as an employee is picked.
alter table employees add column base_salary numeric(14,2) not null default 0;

-- Seed it from each employee's most recent payroll entry so nobody has to
-- re-type salaries that are already on file.
update employees e
set base_salary = latest.base_salary
from (
  select distinct on (employee_id) employee_id, base_salary
  from payroll_entries
  order by employee_id, pay_period desc, created_at desc
) latest
where latest.employee_id = e.id;

-- 2) เบี้ยขยัน (diligence allowance) as a new income line.
alter table payroll_entries add column diligence_allowance numeric(14,2) not null default 0;

-- total_income/net_salary are generated columns — Postgres has no ALTER for
-- a generated expression, so they're dropped and re-added with
-- diligence_allowance folded into the same formula (same approach as
-- migration_087). total_deductions is untouched: it is income only.
alter table payroll_entries drop column total_income;
alter table payroll_entries drop column net_salary;

alter table payroll_entries
  add column total_income numeric(14,2) generated always as (
    base_salary + fuel_allowance + commission + incentive + ot_pay + diligence_allowance
  ) stored;
alter table payroll_entries
  add column net_salary numeric(14,2) generated always as (
    base_salary + fuel_allowance + commission + incentive + ot_pay + diligence_allowance
      - social_security - withholding_tax - other_deductions
  ) stored;
