-- migration_034 scoped 'sales' read access to only their own rep's
-- projects, but the user clarified Sales should be able to see OTHER
-- sales reps' figures too (e.g. the Sales Dashboard's "ผลงานรายเซลล์"
-- performance-by-rep chart is meant to compare everyone, not just show
-- one bar). Widens SELECT to any authenticated user — matching the same
-- "any logged-in staff can read" shape already used for customers/
-- sales_reps — while write access for 'sales' stays fully blocked
-- (unchanged), so WALLPOD Project Sales create/edit is still off-limits.

drop policy if exists projects_select on projects;
create policy projects_select on projects for select using (auth.uid() is not null);

drop policy if exists project_items_select on project_items;
create policy project_items_select on project_items for select using (auth.uid() is not null);

drop policy if exists payments_select on payments;
create policy payments_select on payments for select using (auth.uid() is not null);
