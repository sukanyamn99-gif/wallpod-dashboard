-- ============ ค่าใช้จ่าย (Expenses): Payment Voucher + เงินสดย่อย ============
-- Same tier as Stock Requisition/Goods Receipt: Sale tier denied entirely
-- (this is cost/financial data), Staff+Admin can read, and write is
-- widened to the 'account' role specifically (this app's dedicated
-- accounting role) alongside owner/manager — mirrors how 'production' was
-- added to stock-movement write access for the same reason.

-- ---------- Payment Voucher (ใบสำคัญจ่าย) ----------
-- A flat record per outgoing payment — full CRUD (unlike petty cash below,
-- there's no running balance to protect, so edit/delete are safe and useful
-- here, matching goods_receipts/stock_requisitions' precedent).
create table payment_vouchers (
  id uuid primary key default gen_random_uuid(),
  doc_no text not null unique,
  voucher_date date not null default current_date,
  payee_name text not null,
  category text,
  amount numeric(14,2) not null,
  payment_method text,
  reference_no text,
  note text,
  recorded_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

alter table payment_vouchers enable row level security;

create policy payment_vouchers_select on payment_vouchers for select
  using (my_role() <> 'sales');
create policy payment_vouchers_insert on payment_vouchers for insert
  with check (my_role() in ('owner', 'manager', 'account'));
create policy payment_vouchers_update on payment_vouchers for update
  using (my_role() in ('owner', 'manager') or recorded_by = auth.uid())
  with check (my_role() in ('owner', 'manager') or recorded_by = auth.uid());
create policy payment_vouchers_delete on payment_vouchers for delete
  using (my_role() in ('owner', 'manager') or recorded_by = auth.uid());

-- ---------- เงินสดย่อย (Petty Cash) ----------
-- Append-only ledger with a running balance — deliberately no edit/delete
-- policy. A running-balance chain can't be edited or deleted in the middle
-- without recomputing every later balance (a real class of complexity this
-- sidesteps entirely); a mistake gets corrected the way real bookkeeping
-- does it, with an offsetting entry, not by rewriting history. Same
-- append-only shape as login_log/activity_log/sales_lead_change_log.
create table petty_cash_transactions (
  id uuid primary key default gen_random_uuid(),
  doc_no text not null unique,
  transaction_date date not null default current_date,
  transaction_type text not null check (transaction_type in ('topup', 'expense')),
  amount numeric(14,2) not null,
  description text not null,
  balance_after numeric(14,2) not null,
  recorded_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

alter table petty_cash_transactions enable row level security;

create policy petty_cash_select on petty_cash_transactions for select
  using (my_role() <> 'sales');
create policy petty_cash_insert on petty_cash_transactions for insert
  with check (my_role() in ('owner', 'manager', 'account'));
-- No update/delete policy — append-only, see comment above.

-- Only writer of balance_after — computes it atomically from the last
-- transaction so two near-simultaneous entries can never both read the
-- same stale balance (the same concurrency reasoning as record_stock_movement).
create function record_petty_cash_transaction(
  p_doc_no text, p_type text, p_amount numeric, p_description text
)
returns void language plpgsql security definer as $$
declare
  v_last_balance numeric(14,2);
  v_new_balance numeric(14,2);
begin
  if my_role() not in ('owner', 'manager', 'account') then
    raise exception 'permission denied';
  end if;

  select balance_after into v_last_balance
  from petty_cash_transactions
  order by created_at desc
  limit 1;
  v_last_balance := coalesce(v_last_balance, 0);

  v_new_balance := case
    when p_type = 'topup' then v_last_balance + p_amount
    else v_last_balance - p_amount
  end;

  insert into petty_cash_transactions (doc_no, transaction_type, amount, description, balance_after, recorded_by)
  values (p_doc_no, p_type, p_amount, p_description, v_new_balance, auth.uid());
end;
$$;
