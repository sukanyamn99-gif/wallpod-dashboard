alter table stock_products
  add column sku text,
  add column thickness text,
  add column location text,
  add column updated_at timestamptz not null default now();

-- security definer bypasses stock_movements_insert's RLS check for its own
-- write, so the role check has to be re-asserted explicitly inside here.
create or replace function record_stock_movement(p_product_id uuid, p_type text, p_qty numeric, p_note text)
returns void language plpgsql security definer as $$
begin
  if my_role() not in ('owner', 'manager', 'production') then
    raise exception 'permission denied';
  end if;

  insert into stock_movements (stock_product_id, movement_type, quantity, note, created_by)
  values (p_product_id, p_type, p_qty, p_note, auth.uid());

  update stock_products
  set quantity_on_hand = quantity_on_hand + (case when p_type = 'in' then p_qty else -p_qty end),
      updated_at = now()
  where id = p_product_id;
end;
$$;
