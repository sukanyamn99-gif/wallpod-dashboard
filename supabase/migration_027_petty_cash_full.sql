-- ============ Extend Petty Cash to match the real reconciliation sheet ============
-- The reference sheet reports a period's expense rows split into fixed
-- category columns (ค่าจ้าง-ค่าบริการ, อุปกรณ์สำนักงาน, ค่าโทรศัพท์, ...) with
-- a running balance and per-category totals. Rather than a fixed column
-- set, `category` stays free text — the print/report page pivots whatever
-- categories are actually in use into columns, the same technique already
-- used for WALLPOD Project Sales' product-category columns.

alter table petty_cash_transactions
  add column category text,
  add column biller_name text,
  add column job_no text,
  add column vat_amount numeric(14, 2) not null default 0,
  add column wht_amount numeric(14, 2) not null default 0;

-- `create or replace function` cannot change a parameter list (confirmed the
-- hard way in migration_014 — it silently creates a second overload that
-- PostgREST then can't disambiguate) — drop the old 4-arg signature first.
drop function if exists record_petty_cash_transaction(text, text, numeric, text);

create function record_petty_cash_transaction(
  p_doc_no text, p_type text, p_amount numeric, p_description text,
  p_category text default null, p_biller_name text default null, p_job_no text default null,
  p_vat_amount numeric default 0, p_wht_amount numeric default 0, p_transaction_date date default current_date
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
    category, biller_name, job_no, vat_amount, wht_amount, transaction_date
  )
  values (
    p_doc_no, p_type, p_amount, p_description, v_new_balance, auth.uid(),
    p_category, p_biller_name, p_job_no, p_vat_amount, p_wht_amount, p_transaction_date
  );
end;
$$;
