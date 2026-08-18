-- ============ Stock Product Lots (view-only lot/batch quantity tracking) ============
-- Each Goods Receipt line creates one lot row here, carrying its own unit_cost
-- (separate from stock_products.unit_cost, which stays the blended weighted
-- average used for reporting). "out" movements consume lots oldest-first
-- (FIFO) automatically so quantity_remaining stays accurate — but this is
-- purely for visibility: no flow ever asks the user to pick a lot.
--
-- Legacy stock recorded before this feature existed (the original Excel
-- import, and any "in" movement/adjustment that isn't a goods receipt) has no
-- lot of origin, so a product's lot totals may be less than its
-- quantity_on_hand — the UI must treat that gap as "unspecified lot", not a
-- bug.
--
-- Known, accepted limitation (same class as goods receipt delete/edit's
-- existing documented gaps): editing or deleting a goods receipt does NOT
-- retroactively adjust the lot row it created — edit works per-product
-- aggregate (see edit_goods_receipt_item), not per line, so there is no
-- single lot to safely re-target. The lot stays as originally received.

create table stock_product_lots (
  id uuid primary key default gen_random_uuid(),
  stock_product_id uuid not null references stock_products(id) on delete cascade,
  quantity_received numeric(14,2) not null,
  quantity_remaining numeric(14,2) not null,
  unit_cost numeric(14,2) not null,
  reference_no text,
  received_at timestamptz not null default now()
);

alter table stock_product_lots enable row level security;

create policy stock_product_lots_select on stock_product_lots for select using (my_role() <> 'sales');
-- No insert/update/delete policy: only ever mutated by record_goods_receipt /
-- record_stock_movement below, both security definer.

-- Same signature as before — adds one insert at the end, no drop needed.
create or replace function record_goods_receipt(
  p_product_id uuid, p_qty numeric, p_unit_cost numeric, p_note text, p_reference text default null
)
returns void language plpgsql security definer as $$
declare
  v_before numeric(14,2);
  v_after numeric(14,2);
  v_old_cost numeric(14,2);
  v_new_avg_cost numeric(14,2);
begin
  if my_role() not in ('owner', 'manager', 'production') then
    raise exception 'permission denied';
  end if;

  select quantity_on_hand, unit_cost into v_before, v_old_cost from stock_products where id = p_product_id;
  v_after := v_before + p_qty;

  v_new_avg_cost := case
    when v_after = 0 then v_old_cost
    else ((v_before * v_old_cost) + (p_qty * p_unit_cost)) / v_after
  end;

  insert into stock_movements (stock_product_id, movement_type, quantity, note, created_by, balance_before, balance_after, reference_no)
  values (p_product_id, 'in', p_qty, p_note, auth.uid(), v_before, v_after, p_reference);

  update stock_products
  set quantity_on_hand = v_after, unit_cost = v_new_avg_cost, updated_at = now()
  where id = p_product_id;

  insert into stock_product_lots (stock_product_id, quantity_received, quantity_remaining, unit_cost, reference_no)
  values (p_product_id, p_qty, p_qty, p_unit_cost, p_reference);
end;
$$;

-- Same signature as before — adds FIFO lot consumption on 'out' movements
-- (oldest lot first), no drop needed. Every existing "out" caller (Stock
-- Product quick-entry Sheet, Low Stock Alert's Record IN, Stock Requisition
-- deduction) gets this for free with no call-site changes.
create or replace function record_stock_movement(
  p_product_id uuid, p_type text, p_qty numeric, p_note text, p_reference text default null
)
returns void language plpgsql security definer as $$
declare
  v_before numeric(14,2);
  v_after numeric(14,2);
  v_remaining numeric(14,2);
  v_lot record;
  v_consume numeric(14,2);
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

  if p_type = 'out' then
    v_remaining := p_qty;
    for v_lot in
      select id, quantity_remaining from stock_product_lots
      where stock_product_id = p_product_id and quantity_remaining > 0
      order by received_at asc
      for update
    loop
      exit when v_remaining <= 0;
      v_consume := least(v_lot.quantity_remaining, v_remaining);
      update stock_product_lots set quantity_remaining = quantity_remaining - v_consume where id = v_lot.id;
      v_remaining := v_remaining - v_consume;
    end loop;
  end if;
end;
$$;
