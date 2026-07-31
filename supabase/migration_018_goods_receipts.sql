create table suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  address text,
  tax_id text,
  branch text,
  created_at timestamptz not null default now()
);
alter table suppliers enable row level security;
create policy suppliers_select on suppliers for select using (auth.uid() is not null);
create policy suppliers_write on suppliers for all
  using (my_role() in ('owner','manager')) with check (my_role() in ('owner','manager'));

create table goods_receipts (
  id uuid primary key default gen_random_uuid(),
  doc_no text not null unique,
  supplier_id uuid references suppliers(id),
  received_by uuid references profiles(id),
  reference_no text,
  note text,
  created_at timestamptz not null default now()
);

create table goods_receipt_items (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references goods_receipts(id) on delete cascade,
  stock_product_id uuid references stock_products(id) on delete set null,
  product_name_snapshot text not null,
  product_sku_snapshot text,
  unit_snapshot text not null default 'ชิ้น',
  quantity numeric(14,2) not null,
  unit_cost numeric(14,2) not null
);

alter table goods_receipts enable row level security;
alter table goods_receipt_items enable row level security;

create policy goods_receipts_select on goods_receipts for select using (my_role() <> 'sales');
create policy goods_receipts_insert on goods_receipts for insert
  with check (my_role() in ('owner','manager','production'));
create policy goods_receipts_delete on goods_receipts for delete
  using (my_role() in ('owner','manager') or received_by = auth.uid());

create policy goods_receipt_items_select on goods_receipt_items for select using (my_role() <> 'sales');
create policy goods_receipt_items_insert on goods_receipt_items for insert
  with check (my_role() in ('owner','manager','production'));

-- New, separate RPC — does not modify record_stock_movement, which is used by
-- flows that never asked to carry a cost basis (Stock Product quick-entry
-- Sheet, Low Stock Alert's Record IN, Stock Requisition's deduction). Only a
-- formal goods receipt recalculates the weighted-average unit_cost.
create function record_goods_receipt(
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
end;
$$;
