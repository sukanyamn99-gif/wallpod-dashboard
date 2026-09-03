-- Adds the RLS policies needed to edit a billing document. billing_notes
-- only had select/insert/delete; billing_note_items only had select/insert.
-- Edit updates the header in place and replaces items via delete-then-
-- reinsert (same pattern as WALLPOD Project Sales / Stock Requisition /
-- Goods Receipt edits), so both tables need one more policy each.
-- Permission shape matches the existing billing_notes_delete rule exactly
-- (my_role() <> 'sales', not further scoped to the creator at the RLS
-- layer) — the narrower "owner/manager or the original creator" rule is a
-- UI-level gate on the edit/delete buttons, same as the rest of this app.

create policy billing_notes_update on billing_notes for update
  using (my_role() <> 'sales') with check (my_role() <> 'sales');

create policy billing_note_items_delete on billing_note_items for delete
  using (exists (select 1 from billing_notes bn where bn.id = billing_note_id and my_role() <> 'sales'));
