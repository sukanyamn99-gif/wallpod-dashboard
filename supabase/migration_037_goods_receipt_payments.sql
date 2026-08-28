-- Partial payments against a goods receipt (e.g. a supplier debt paid off
-- in ฿100,000/month installments) — payment_status/paid_date on
-- goods_receipts stays for the common "paid in one shot" case; this table
-- lets a receipt's remaining balance shrink over several months instead.
create table goods_receipt_payments (
  id uuid primary key default gen_random_uuid(),
  goods_receipt_id uuid not null references goods_receipts(id) on delete cascade,
  amount numeric(14,2) not null check (amount > 0),
  paid_date date not null,
  note text,
  paid_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
alter table goods_receipt_payments enable row level security;

create policy goods_receipt_payments_select on goods_receipt_payments for select
  using (my_role() <> 'sales');
create policy goods_receipt_payments_insert on goods_receipt_payments for insert
  with check (my_role() in ('owner','manager','account'));
-- Delete only, to fix a mis-entered amount/date — no update policy, so a
-- correction is "remove and re-add" (append-only-ish, matches this app's
-- existing convention for financial log tables).
create policy goods_receipt_payments_delete on goods_receipt_payments for delete
  using (my_role() in ('owner','manager','account'));
