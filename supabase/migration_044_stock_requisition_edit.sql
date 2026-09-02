-- Adds the RLS policies needed to edit a Stock Requisition (ใบเบิกสินค้า).
-- stock_requisitions only had select/insert/delete; stock_requisition_items
-- only had select/insert. Edit updates the header in place and replaces the
-- items via delete-then-reinsert (same pattern as WALLPOD Project Sales and
-- Goods Receipt edits), so both tables need one more policy each. Permission
-- shape mirrors the existing stock_requisitions_delete rule exactly: owner/
-- manager can edit any requisition, anyone else only their own.

create policy stock_requisitions_update on stock_requisitions for update
  using (my_role() in ('owner','manager') or requested_by = auth.uid())
  with check (my_role() in ('owner','manager') or requested_by = auth.uid());

create policy stock_requisition_items_delete on stock_requisition_items for delete
  using (exists (
    select 1 from stock_requisitions sr
    where sr.id = requisition_id and (my_role() in ('owner','manager') or sr.requested_by = auth.uid())
  ));
