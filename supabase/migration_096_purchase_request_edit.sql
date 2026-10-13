-- Purchase requests can now be edited.
--
-- Who may edit:
--  - the requester, while the request is still pending ('รออนุมัติ');
--  - owner/manager at any time (the app puts an approved/rejected request back
--    to pending when they edit it, so it needs approving again).
--
-- WITH CHECK requires the saved row to still be pending for a requester, so a
-- requester can never flip their own request to approved through the API.
-- (Owner/manager are the only ones who approve, same as before.)

drop policy if exists purchase_requests_update on purchase_requests;
create policy purchase_requests_update on purchase_requests for update
  using (
    my_role() in ('owner', 'manager')
    or (requested_by = auth.uid() and status = 'รออนุมัติ')
  )
  with check (
    my_role() in ('owner', 'manager')
    or (requested_by = auth.uid() and status = 'รออนุมัติ')
  );

-- Editing replaces the item rows, which needs a delete policy on the child
-- table (it only had select/insert). Same rule as updating the parent.
create policy purchase_request_items_delete on purchase_request_items for delete
  using (exists (
    select 1 from purchase_requests r
    where r.id = request_id
      and (
        my_role() in ('owner', 'manager')
        or (r.requested_by = auth.uid() and r.status = 'รออนุมัติ')
      )
  ));
