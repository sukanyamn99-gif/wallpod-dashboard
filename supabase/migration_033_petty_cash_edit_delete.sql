-- Petty cash was originally append-only by design (see the comment above
-- petty_cash_transactions in schema.sql) specifically because balance_after
-- is a running total — editing/deleting an old row would leave every later
-- row's balance wrong. The user explicitly asked for full edit/delete
-- anyway, so this adds it the only correct way: every write recomputes the
-- ENTIRE chain's balance_after in chronological order inside the same
-- transaction, rather than leaving stale balances behind.

create policy petty_cash_update on petty_cash_transactions for update
  using (my_role() in ('owner', 'manager', 'account'))
  with check (my_role() in ('owner', 'manager', 'account'));
create policy petty_cash_delete on petty_cash_transactions for delete
  using (my_role() in ('owner', 'manager', 'account'));

create function recompute_petty_cash_balances()
returns void language plpgsql security definer as $$
declare
  r record;
  v_balance numeric(14,2) := 0;
begin
  for r in select id, transaction_type, amount from petty_cash_transactions order by created_at asc
  loop
    v_balance := case when r.transaction_type = 'topup' then v_balance + r.amount else v_balance - r.amount end;
    update petty_cash_transactions set balance_after = v_balance where id = r.id;
  end loop;
end;
$$;

-- doc_no and created_at (the chain's ordering key) are deliberately not
-- editable — everything else on the row can change.
create function update_petty_cash_transaction(
  p_id uuid, p_type text, p_amount numeric, p_description text,
  p_category text default null, p_biller_name text default null, p_job_no text default null,
  p_vat_amount numeric default 0, p_wht_amount numeric default 0, p_transaction_date date default current_date
)
returns void language plpgsql security definer as $$
begin
  if my_role() not in ('owner', 'manager', 'account') then
    raise exception 'permission denied';
  end if;

  update petty_cash_transactions
  set transaction_type = p_type, amount = p_amount, description = p_description,
      category = p_category, biller_name = p_biller_name, job_no = p_job_no,
      vat_amount = p_vat_amount, wht_amount = p_wht_amount, transaction_date = p_transaction_date
  where id = p_id;

  perform recompute_petty_cash_balances();
end;
$$;

create function delete_petty_cash_transaction(p_id uuid)
returns void language plpgsql security definer as $$
begin
  if my_role() not in ('owner', 'manager', 'account') then
    raise exception 'permission denied';
  end if;

  delete from petty_cash_transactions where id = p_id;

  perform recompute_petty_cash_balances();
end;
$$;
