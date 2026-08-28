-- Tracks whether each goods receipt (supplier invoice) has been paid yet,
-- so "เจ้าหนี้คงค้าง" (accounts payable) can be computed from real data
-- instead of guessing. Mirrors payments.status on the AR side, but simpler
-- (one flag per receipt, no installments) since that's all this was asked
-- to support.
alter table goods_receipts
  add column payment_status text not null default 'ยังไม่จ่าย'
    check (payment_status in ('จ่ายแล้ว', 'ยังไม่จ่าย')),
  add column paid_date date;

-- 'account' needs to mark receipts paid/unpaid on the new เจ้าหนี้คงค้าง
-- page — the existing update policy (owner/manager, or production on their
-- own receipt) predates that page and never included it. Widening this is
-- row-level, not column-level (Postgres RLS can't scope to just
-- payment_status/paid_date), so 'account' also gains the ability to edit a
-- receipt's supplier/items/note this way — consistent with 'account'
-- already having full insert rights on this table.
drop policy if exists goods_receipts_update on goods_receipts;
create policy goods_receipts_update on goods_receipts for update
  using (my_role() in ('owner','manager','account') or (my_role() = 'production' and received_by = auth.uid()))
  with check (my_role() in ('owner','manager','account') or (my_role() = 'production' and received_by = auth.uid()));
