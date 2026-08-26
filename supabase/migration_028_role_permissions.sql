-- Granular per-role permissions rework.
--
-- support_sale (ทีม Support) and account (ธุรการบัญชี) gain "add but not
-- edit" rights on stock_products / product_categories / goods_receipts /
-- stock_requisitions — they can create new rows but cannot update or
-- delete existing ones (owner/manager keep full control; production keeps
-- its existing self-service edit on goods receipts it received).
--
-- design (Designer) loses write access to Project Sales entirely — view
-- only, matching the app's UI which no longer routes them to any create/
-- edit screen.
--
-- account gains full parity with owner/manager on Payment Voucher
-- update/delete (not just its own vouchers), matching "full access to the
-- Expenses menu and its submenus".
--
-- login_log/activity_log become readable by manager too (previously
-- owner-only), since manager now sees "ทุกเมนู" including เก็บ log การใช้งาน.

-- 1. stock_products: split the single "for all" write policy into insert
--    (owner/manager/support_sale/account) vs update/delete (owner/manager
--    only).
drop policy if exists stock_products_write on stock_products;
create policy stock_products_insert on stock_products for insert
  with check (my_role() in ('owner','manager','support_sale','account'));
create policy stock_products_update on stock_products for update
  using (my_role() in ('owner','manager')) with check (my_role() in ('owner','manager'));
create policy stock_products_delete on stock_products for delete
  using (my_role() in ('owner','manager'));

-- 2. product_categories: same split.
drop policy if exists product_categories_write on product_categories;
create policy product_categories_insert on product_categories for insert
  with check (my_role() in ('owner','manager','support_sale','account'));
create policy product_categories_update on product_categories for update
  using (my_role() in ('owner','manager')) with check (my_role() in ('owner','manager'));
create policy product_categories_delete on product_categories for delete
  using (my_role() in ('owner','manager'));

-- 3. stock_requisitions / stock_requisition_items: widen insert only —
--    neither table has an update policy for anyone, so "add but not edit"
--    is automatic; delete stays as-is (unrestricted by role, matching the
--    existing "own submission or admin" rule, which the new roles inherit
--    the same as production already does).
drop policy if exists stock_requisitions_insert on stock_requisitions;
create policy stock_requisitions_insert on stock_requisitions for insert
  with check (my_role() in ('owner','manager','production','support_sale','account'));
drop policy if exists stock_requisition_items_insert on stock_requisition_items;
create policy stock_requisition_items_insert on stock_requisition_items for insert
  with check (my_role() in ('owner','manager','production','support_sale','account'));

-- 4. goods_receipts / goods_receipt_items: widen insert the same way, but
--    tighten update/delete to explicitly require production (not just any
--    role) for the self-service "own receipt" clause — otherwise
--    support_sale/account would automatically gain edit/delete on receipts
--    they just created via the existing ownership check alone.
drop policy if exists goods_receipts_insert on goods_receipts;
create policy goods_receipts_insert on goods_receipts for insert
  with check (my_role() in ('owner','manager','production','support_sale','account'));
drop policy if exists goods_receipt_items_insert on goods_receipt_items;
create policy goods_receipt_items_insert on goods_receipt_items for insert
  with check (my_role() in ('owner','manager','production','support_sale','account'));

drop policy if exists goods_receipts_update on goods_receipts;
create policy goods_receipts_update on goods_receipts for update
  using (my_role() in ('owner','manager') or (my_role() = 'production' and received_by = auth.uid()))
  with check (my_role() in ('owner','manager') or (my_role() = 'production' and received_by = auth.uid()));

drop policy if exists goods_receipts_delete on goods_receipts;
create policy goods_receipts_delete on goods_receipts for delete
  using (my_role() in ('owner','manager') or (my_role() = 'production' and received_by = auth.uid()));

drop policy if exists goods_receipt_items_delete on goods_receipt_items;
create policy goods_receipt_items_delete on goods_receipt_items for delete
  using (exists (
    select 1 from goods_receipts gr
    where gr.id = receipt_id
      and (my_role() in ('owner','manager') or (my_role() = 'production' and gr.received_by = auth.uid()))
  ));

-- 5. record_stock_movement / record_goods_receipt RPCs: widen the role
--    check so support_sale/account can actually go through with the
--    goods-receipt and stock-requisition create flows above (both call
--    these RPCs internally to move stock). Bodies are otherwise identical
--    to the current live functions (FIFO lot consumption on 'out',
--    weighted-average cost + lot insert on receipt) — only the role check
--    changes. Same signatures as today, so `create or replace` is safe
--    (no parameter-list change). edit_goods_receipt_item is deliberately
--    left untouched — editing an existing receipt stays owner/manager/
--    production only.
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
  if my_role() not in ('owner', 'manager', 'production', 'support_sale', 'account') then
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
  if my_role() not in ('owner', 'manager', 'production', 'support_sale', 'account') then
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

-- 6. Project Sales: exclude 'design' from write access — view only.
--    Everyone else who currently has write access (owner/manager/
--    support_sale/account/foreman/production) is unaffected.
drop policy if exists projects_write on projects;
create policy projects_write on projects for all
  using (my_role() not in ('sales','design')) with check (my_role() not in ('sales','design'));

drop policy if exists project_items_write on project_items;
create policy project_items_write on project_items for all
  using (exists (select 1 from projects p where p.id = project_id and my_role() not in ('sales','design')));

drop policy if exists payments_write on payments;
create policy payments_write on payments for all using (my_role() not in ('sales','design'));

-- 7. Expenses: give 'account' full parity with owner/manager on Payment
--    Voucher update/delete (not just its own vouchers) — "full add/edit/
--    delete access to the Expenses menu". Petty cash stays append-only
--    for every role (by design — no update/delete policy exists for
--    anyone; corrections happen via offsetting entries).
drop policy if exists payment_vouchers_update on payment_vouchers;
create policy payment_vouchers_update on payment_vouchers for update
  using (my_role() in ('owner', 'manager', 'account') or recorded_by = auth.uid())
  with check (my_role() in ('owner', 'manager', 'account') or recorded_by = auth.uid());

drop policy if exists payment_vouchers_delete on payment_vouchers;
create policy payment_vouchers_delete on payment_vouchers for delete
  using (my_role() in ('owner', 'manager', 'account') or recorded_by = auth.uid());

drop policy if exists payment_voucher_ledger_lines_write on payment_voucher_ledger_lines;
create policy payment_voucher_ledger_lines_write on payment_voucher_ledger_lines for all
  using (exists (
    select 1 from payment_vouchers v
    where v.id = voucher_id and (my_role() in ('owner', 'manager', 'account') or v.recorded_by = auth.uid())
  ))
  with check (exists (
    select 1 from payment_vouchers v
    where v.id = voucher_id and (my_role() in ('owner', 'manager', 'account') or v.recorded_by = auth.uid())
  ));

-- 8. Settings > เก็บ log การใช้งาน: manager now also gets this menu
--    ("ทุกเมนู"), so the underlying data must be readable by manager too,
--    not just owner.
drop policy if exists login_log_select on login_log;
create policy login_log_select on login_log for select
  using (my_role() in ('owner','manager'));

drop policy if exists activity_log_select on activity_log;
create policy activity_log_select on activity_log for select
  using (my_role() in ('owner','manager'));
