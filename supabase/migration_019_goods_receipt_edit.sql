create policy goods_receipts_update on goods_receipts for update
  using (my_role() in ('owner','manager') or received_by = auth.uid())
  with check (my_role() in ('owner','manager') or received_by = auth.uid());

create policy goods_receipt_items_delete on goods_receipt_items for delete
  using (exists (
    select 1 from goods_receipts gr
    where gr.id = receipt_id and (my_role() in ('owner','manager') or gr.received_by = auth.uid())
  ));

-- Edits reverse the line's original (qty, cost) contribution against the
-- product's CURRENT stock state, then apply the edited one — same
-- weighted-average formula as record_goods_receipt, run twice. Passing
-- p_old_qty=0 (new line) or p_new_qty=0 (removed line) skips the matching
-- half cleanly. Deliberately separate from record_goods_receipt so create
-- and edit stay on independent code paths.
create function edit_goods_receipt_item(
  p_product_id uuid, p_old_qty numeric, p_old_cost numeric,
  p_new_qty numeric, p_new_cost numeric, p_note text, p_reference text default null
)
returns void language plpgsql security definer as $$
declare
  v_before numeric(14,2);
  v_cost numeric(14,2);
  v_after_reverse numeric(14,2);
  v_after numeric(14,2);
begin
  if my_role() not in ('owner', 'manager', 'production') then
    raise exception 'permission denied';
  end if;

  select quantity_on_hand, unit_cost into v_before, v_cost from stock_products where id = p_product_id;

  v_after_reverse := v_before - p_old_qty;
  v_cost := case when v_after_reverse <= 0 then v_cost
                 else ((v_before * v_cost) - (p_old_qty * p_old_cost)) / v_after_reverse end;

  v_after := v_after_reverse + p_new_qty;
  v_cost := case when v_after = 0 then v_cost
                  else ((v_after_reverse * v_cost) + (p_new_qty * p_new_cost)) / v_after end;

  insert into stock_movements (stock_product_id, movement_type, quantity, note, created_by, balance_before, balance_after, reference_no)
  values (p_product_id, case when p_new_qty >= p_old_qty then 'in' else 'out' end,
          abs(p_new_qty - p_old_qty), p_note, auth.uid(), v_before, v_after, p_reference);

  update stock_products set quantity_on_hand = v_after, unit_cost = v_cost, updated_at = now()
  where id = p_product_id;
end;
$$;
