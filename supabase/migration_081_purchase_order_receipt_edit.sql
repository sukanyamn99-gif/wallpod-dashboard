-- Lets a ใบรับสินค้า (receiving against a Purchase Order) be edited —
-- reuses the existing edit_goods_receipt_item RPC (built for the ad-hoc
-- รับเข้าสินค้า feature) since it's already a general product-id/qty/cost
-- weighted-average reversal-then-reapply, not tied to which table the
-- receipt document itself lives in.
create policy purchase_order_receipts_update on purchase_order_receipts for update
  using (my_role() in ('owner', 'manager') or received_by = auth.uid())
  with check (my_role() in ('owner', 'manager') or received_by = auth.uid());

create policy purchase_order_receipt_items_delete on purchase_order_receipt_items for delete
  using (
    exists (
      select 1 from purchase_order_receipts r
      where r.id = receipt_id and (my_role() in ('owner', 'manager') or r.received_by = auth.uid())
    )
  );

-- updatePurchaseOrderReceipt edits each item row's quantity/unit_cost in
-- place (see actions.ts) — needs its own update policy, same shape as the
-- delete policy above.
create policy purchase_order_receipt_items_update on purchase_order_receipt_items for update
  using (
    exists (
      select 1 from purchase_order_receipts r
      where r.id = receipt_id and (my_role() in ('owner', 'manager') or r.received_by = auth.uid())
    )
  )
  with check (
    exists (
      select 1 from purchase_order_receipts r
      where r.id = receipt_id and (my_role() in ('owner', 'manager') or r.received_by = auth.uid())
    )
  );
