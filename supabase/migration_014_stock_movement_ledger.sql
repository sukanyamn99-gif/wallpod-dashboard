alter table stock_movements
  add column balance_before numeric(14,2),
  add column balance_after numeric(14,2),
  add column reference_no text;

-- create or replace cannot change a function's parameter list — it would
-- silently create a second overload alongside the old one instead of
-- replacing it, leaving PostgREST unable to resolve calls with the old
-- 4-argument shape ("Could not choose the best candidate function").
-- Drop the old signature explicitly first.
drop function if exists record_stock_movement(uuid, text, numeric, text);

create or replace function record_stock_movement(
  p_product_id uuid, p_type text, p_qty numeric, p_note text, p_reference text default null
)
returns void language plpgsql security definer as $$
declare
  v_before numeric(14,2);
  v_after numeric(14,2);
begin
  if my_role() not in ('owner', 'manager', 'production') then
    raise exception 'permission denied';
  end if;

  select quantity_on_hand into v_before from stock_products where id = p_product_id;
  v_after := v_before + (case when p_type = 'in' then p_qty else -p_qty end);

  insert into stock_movements (stock_product_id, movement_type, quantity, note, created_by, balance_before, balance_after, reference_no)
  values (p_product_id, p_type, p_qty, p_note, auth.uid(), v_before, v_after, p_reference);

  update stock_products
  set quantity_on_hand = v_after, updated_at = now()
  where id = p_product_id;
end;
$$;
