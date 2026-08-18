-- Syncs stock_product_lots when a goods receipt is edited — closes the
-- "known, accepted limitation" documented in migration_021: since a product
-- can appear at most once per receipt (enforced by the app, Phase 19), the
-- pair (stock_product_id, reference_no = doc_no) uniquely identifies the lot
-- a given receipt line created. That makes a precise, direct update possible
-- (unlike the aggregate stock_products row, which has no such per-line key).
--
-- On edit: find the lot by (product, doc_no). If found, preserve however
-- much of it has already been consumed by later "out" movements
-- (quantity_received - quantity_remaining) and resize both fields around
-- the edited quantity/cost. If not found (a line newly added during the
-- edit), insert a fresh lot. If the edited quantity is 0 (line removed),
-- the lot's remaining is zeroed — it simply stops appearing in the
-- (quantity_remaining > 0) view, same as any other fully-consumed lot.

create or replace function edit_goods_receipt_item(
  p_product_id uuid, p_old_qty numeric, p_old_cost numeric,
  p_new_qty numeric, p_new_cost numeric, p_note text, p_reference text default null
)
returns void language plpgsql security definer as $$
declare
  v_before numeric(14,2);
  v_cost numeric(14,2);
  v_after_reverse numeric(14,2);
  v_after numeric(14,2);
  v_lot record;
  v_consumed numeric(14,2);
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

  if p_reference is not null then
    select id, quantity_received, quantity_remaining into v_lot
    from stock_product_lots
    where stock_product_id = p_product_id and reference_no = p_reference
    limit 1;

    if v_lot.id is not null then
      v_consumed := v_lot.quantity_received - v_lot.quantity_remaining;
      update stock_product_lots
      set quantity_received = p_new_qty,
          quantity_remaining = greatest(0, p_new_qty - v_consumed),
          unit_cost = p_new_cost
      where id = v_lot.id;
    elsif p_new_qty > 0 then
      insert into stock_product_lots (stock_product_id, quantity_received, quantity_remaining, unit_cost, reference_no)
      values (p_product_id, p_new_qty, p_new_qty, p_new_cost, p_reference);
    end if;
  end if;
end;
$$;
