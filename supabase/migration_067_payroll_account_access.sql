-- Widens employees/payroll_entries RLS to include the account role
-- (ธุรการบัญชี) — the app's page-level gate (src/lib/permissions.ts) was
-- already opened to account for /dashboard/expenses/payroll, but the
-- underlying tables' RLS still only allowed owner/manager, so account
-- could reach the page but every query silently returned zero rows.
drop policy if exists employees_select on employees;
create policy employees_select on employees for select
  using (my_role() in ('owner', 'manager', 'account'));
drop policy if exists employees_write on employees;
create policy employees_write on employees for all
  using (my_role() in ('owner', 'manager', 'account')) with check (my_role() in ('owner', 'manager', 'account'));

drop policy if exists payroll_entries_select on payroll_entries;
create policy payroll_entries_select on payroll_entries for select
  using (my_role() in ('owner', 'manager', 'account'));
drop policy if exists payroll_entries_write on payroll_entries;
create policy payroll_entries_write on payroll_entries for all
  using (my_role() in ('owner', 'manager', 'account')) with check (my_role() in ('owner', 'manager', 'account'));
