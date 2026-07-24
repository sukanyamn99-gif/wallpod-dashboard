-- WALLPOD Project Sales: widen to admin+staff, drop the sales_rep_id path entirely
-- (Sale tier no longer has any access to this feature).
drop policy if exists projects_select on projects;
drop policy if exists projects_write on projects;
create policy projects_select on projects for select using (my_role() <> 'sales');
create policy projects_write on projects for all
  using (my_role() <> 'sales') with check (my_role() <> 'sales');

drop policy if exists project_items_select on project_items;
drop policy if exists project_items_write on project_items;
create policy project_items_select on project_items for select
  using (exists (select 1 from projects p where p.id = project_id and my_role() <> 'sales'));
create policy project_items_write on project_items for all
  using (exists (select 1 from projects p where p.id = project_id and my_role() <> 'sales'));

drop policy if exists payments_select on payments;
drop policy if exists payments_write on payments;
create policy payments_select on payments for select
  using (exists (select 1 from projects p where p.id = project_id and my_role() <> 'sales'));
create policy payments_write on payments for all using (my_role() <> 'sales');
-- project_costs stays owner/manager-only, untouched — this is the cost/profit data Staff must not see.

-- Product Categories / Stock Requisition / Stock Movement: Sale tier loses read access
-- (Staff keeps it unchanged; only removing "sales" from the previously fully-open "any authenticated" policy).
drop policy if exists product_categories_select on product_categories;
create policy product_categories_select on product_categories for select using (my_role() <> 'sales');

drop policy if exists stock_requisitions_select on stock_requisitions;
create policy stock_requisitions_select on stock_requisitions for select using (my_role() <> 'sales');
drop policy if exists stock_requisition_items_select on stock_requisition_items;
create policy stock_requisition_items_select on stock_requisition_items for select using (my_role() <> 'sales');
drop policy if exists stock_movements_select on stock_movements;
create policy stock_movements_select on stock_movements for select using (my_role() <> 'sales');
