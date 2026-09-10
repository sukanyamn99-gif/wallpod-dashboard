-- Widens project_costs RLS to include the account role (ธุรการบัญชี) —
-- the app's UI-level canSeeCosts()/canSeeProjectCosts() were already
-- opened to account (they need cost/profit figures to compute ค่า
-- Incentive), but project_costs' own RLS still only allowed owner/manager,
-- so account could see the cost columns in the UI but every query would
-- silently return zero rows (same class of gap as migration_067's
-- employees/payroll_entries fix).
drop policy if exists project_costs_select on project_costs;
create policy project_costs_select on project_costs for select
  using (my_role() in ('owner', 'manager', 'account'));
drop policy if exists project_costs_write on project_costs;
create policy project_costs_write on project_costs for all
  using (my_role() in ('owner', 'manager', 'account'));
