-- Lets ใบหัก ณ ที่จ่าย (WHT Certificate) pull from เงินสดย่อย (Petty Cash) too,
-- not just Payment Vouchers — mirrors payment_vouchers' own WHT fields
-- exactly (same column names/check constraints) so both sources share one
-- printable shape. petty_cash_transactions has no separate "payee" concept
-- of its own; biller_name (ผู้เบิก) doubles as the WHT certificate's
-- ผู้ถูกหักภาษี name, since that's the only name already on the record.
alter table petty_cash_transactions
  add column wht_cert_no text,
  add column wht_rate numeric(5,2),
  add column wht_form_type text check (wht_form_type in ('ภ.ง.ด.1', 'ภ.ง.ด.2', 'ภ.ง.ด.3', 'ภ.ง.ด.53')),
  add column payee_tax_id text,
  add column payee_address text,
  add column income_type text not null default '5'
    check (income_type in ('1', '2', '3', '4a', '4b', '5', '6'));

-- create or replace function cannot add parameters without creating a
-- duplicate overload that breaks PostgREST's function resolution (hit this
-- exact issue in migration_014) — the old signature must be dropped first.
drop function if exists record_petty_cash_transaction(text, text, numeric, text, text, text, text, numeric, numeric, date);
drop function if exists update_petty_cash_transaction(uuid, text, numeric, text, text, text, text, numeric, numeric, date);

create function record_petty_cash_transaction(
  p_doc_no text, p_type text, p_amount numeric, p_description text,
  p_category text default null, p_biller_name text default null, p_job_no text default null,
  p_vat_amount numeric default 0, p_wht_amount numeric default 0, p_transaction_date date default current_date,
  p_wht_rate numeric default null, p_wht_form_type text default null, p_wht_cert_no text default null,
  p_payee_tax_id text default null, p_payee_address text default null, p_income_type text default '5'
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

  insert into petty_cash_transactions (
    doc_no, transaction_type, amount, description, balance_after, recorded_by,
    category, biller_name, job_no, vat_amount, wht_amount, transaction_date,
    wht_rate, wht_form_type, wht_cert_no, payee_tax_id, payee_address, income_type
  )
  values (
    p_doc_no, p_type, p_amount, p_description, v_new_balance, auth.uid(),
    p_category, p_biller_name, p_job_no, p_vat_amount, p_wht_amount, p_transaction_date,
    p_wht_rate, p_wht_form_type, p_wht_cert_no, p_payee_tax_id, p_payee_address, p_income_type
  );
end;
$$;

create function update_petty_cash_transaction(
  p_id uuid, p_type text, p_amount numeric, p_description text,
  p_category text default null, p_biller_name text default null, p_job_no text default null,
  p_vat_amount numeric default 0, p_wht_amount numeric default 0, p_transaction_date date default current_date,
  p_wht_rate numeric default null, p_wht_form_type text default null, p_wht_cert_no text default null,
  p_payee_tax_id text default null, p_payee_address text default null, p_income_type text default '5'
)
returns void language plpgsql security definer as $$
begin
  if my_role() not in ('owner', 'manager', 'account') then
    raise exception 'permission denied';
  end if;

  update petty_cash_transactions
  set transaction_type = p_type, amount = p_amount, description = p_description,
      category = p_category, biller_name = p_biller_name, job_no = p_job_no,
      vat_amount = p_vat_amount, wht_amount = p_wht_amount, transaction_date = p_transaction_date,
      wht_rate = p_wht_rate, wht_form_type = p_wht_form_type, wht_cert_no = p_wht_cert_no,
      payee_tax_id = p_payee_tax_id, payee_address = p_payee_address, income_type = p_income_type
  where id = p_id;

  perform recompute_petty_cash_balances();
end;
$$;
