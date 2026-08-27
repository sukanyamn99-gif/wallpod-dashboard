-- migration_016 (Phase 15) blocked the 'sales' role from reading projects/
-- project_items/payments entirely ("<> 'sales'"), but its own comment says
-- the intent was "sales see only their own" — a real mismatch. The full
-- block also silently emptied the Sales Dashboard for the Sale role, since
-- it reads from these same tables (getSalesDashboardRawData). This
-- restores read access scoped to the rep's own projects, matching the
-- exact pattern already used for sales_leads_select; write access for
-- 'sales' stays fully blocked (unchanged), so WALLPOD Project Sales
-- create/edit remains off-limits.

drop policy if exists projects_select on projects;
create policy projects_select on projects for select
  using (my_role() <> 'sales' or sales_rep_id = my_sales_rep_id());

drop policy if exists project_items_select on project_items;
create policy project_items_select on project_items for select
  using (exists (
    select 1 from projects p
    where p.id = project_id and (my_role() <> 'sales' or p.sales_rep_id = my_sales_rep_id())
  ));

drop policy if exists payments_select on payments;
create policy payments_select on payments for select
  using (exists (
    select 1 from projects p
    where p.id = project_id and (my_role() <> 'sales' or p.sales_rep_id = my_sales_rep_id())
  ));
