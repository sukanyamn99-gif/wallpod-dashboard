-- A fully separate system from stock_products (raw materials): finished
-- goods produced from a JOB, received in with a free-typed quantity/price,
-- and withdrawn automatically when a ใบกำกับภาษี (tax_invoice) is issued —
-- kept structurally apart from raw-material stock so a JOB's linked
-- requisition cost (see getJobLinkedCostSummary) can never mix the two.
create table finished_goods (
  id uuid primary key default gen_random_uuid(),
  job_no text,
  name text not null,
  thickness text,
  size text,
  color text,
  quantity_on_hand numeric(14,2) not null default 0,
  unit_cost numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table finished_goods_movements (
  id uuid primary key default gen_random_uuid(),
  finished_good_id uuid not null references finished_goods(id) on delete cascade,
  movement_type text not null check (movement_type in ('in', 'out')),
  quantity numeric(14,2) not null,
  balance_before numeric(14,2),
  balance_after numeric(14,2),
  reference_no text,
  note text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

alter table finished_goods enable row level security;
alter table finished_goods_movements enable row level security;

create policy finished_goods_select on finished_goods for select using (auth.uid() is not null);
create policy finished_goods_insert on finished_goods for insert
  with check (my_role() in ('owner','manager','support_sale','account'));
create policy finished_goods_update on finished_goods for update
  using (my_role() in ('owner','manager')) with check (my_role() in ('owner','manager'));
create policy finished_goods_delete on finished_goods for delete
  using (my_role() in ('owner','manager'));

create policy finished_goods_movements_select on finished_goods_movements for select using (my_role() <> 'sales');
create policy finished_goods_movements_insert on finished_goods_movements for insert
  with check (my_role() in ('owner','manager','production'));

-- One function for both directions: 'in' (receiving, e.g. production
-- output) blends unit_cost with the existing balance via weighted
-- average, same formula as record_goods_receipt for raw materials;
-- 'out' (withdrawal — automatic when a tax invoice is issued) is a plain
-- quantity decrement and ignores p_unit_cost. Role check covers every role
-- that can trigger a write here: finished_goods_insert (create + initial
-- quantity go through this same function) needs owner/manager/support_sale/
-- account; 'production' covers later receive-more movements; 'foreman' is
-- included because the tax-invoice page that triggers automatic 'out'
-- deductions (/dashboard/billing-documents/tax-invoice, see PAGE_ACCESS'
-- STOCK_STAFF list) is reachable by foreman too — narrower than this would
-- silently break that deduction for a foreman-issued tax invoice.
create function record_finished_goods_movement(
  p_id uuid, p_type text, p_qty numeric, p_note text, p_unit_cost numeric default null, p_reference text default null
)
returns void language plpgsql security definer as $$
declare
  v_before numeric(14,2);
  v_after numeric(14,2);
  v_old_cost numeric(14,2);
  v_new_cost numeric(14,2);
begin
  if my_role() not in ('owner', 'manager', 'production', 'support_sale', 'account', 'foreman') then
    raise exception 'permission denied';
  end if;

  select quantity_on_hand, unit_cost into v_before, v_old_cost from finished_goods where id = p_id;
  v_after := v_before + (case when p_type = 'in' then p_qty else -p_qty end);

  v_new_cost := case
    when p_type <> 'in' then v_old_cost
    when v_after = 0 then v_old_cost
    else ((v_before * v_old_cost) + (p_qty * coalesce(p_unit_cost, v_old_cost))) / v_after
  end;

  insert into finished_goods_movements
    (finished_good_id, movement_type, quantity, note, created_by, balance_before, balance_after, reference_no)
  values (p_id, p_type, p_qty, p_note, auth.uid(), v_before, v_after, p_reference);

  update finished_goods
  set quantity_on_hand = v_after, unit_cost = v_new_cost, updated_at = now()
  where id = p_id;
end;
$$;
