-- ============ Extend Payment Voucher to match the real ใบสำคัญจ่าย form ============

alter table payment_vouchers
  add column wht_cert_no text,
  add column description text,
  add column wht_rate numeric(5, 2),
  add column wht_form_type text check (wht_form_type in ('ภ.ง.ด.1', 'ภ.ง.ด.2', 'ภ.ง.ด.3', 'ภ.ง.ด.53')),
  add column wht_amount numeric(14, 2) not null default 0,
  add column bank_name text,
  add column bank_account_no text,
  add column bank_transfer_date date;

-- Backfill: existing rows had no separate "รายการจ่าย" field — the closest
-- prior data was note/category, so carry that forward rather than leaving
-- description blank on already-printed vouchers.
update payment_vouchers set description = coalesce(note, category, payee_name) where description is null;

-- Mini double-entry ledger table printed on the voucher (รหัสบัญชี/CODE,
-- รายการ/DESCRIPTIONS, DEBIT, CREDIT) — a child table, not a fixed row
-- count, since a real voucher can post to any number of GL accounts.
create table payment_voucher_ledger_lines (
  id uuid primary key default gen_random_uuid(),
  voucher_id uuid not null references payment_vouchers(id) on delete cascade,
  account_code text,
  description text,
  debit numeric(14, 2) not null default 0,
  credit numeric(14, 2) not null default 0,
  sort_order int not null default 0
);

alter table payment_voucher_ledger_lines enable row level security;

-- Visibility/write rules mirror the parent voucher exactly (same tier
-- reasoning as project_items following projects) rather than duplicating
-- role lists that could drift out of sync with the parent policy.
create policy payment_voucher_ledger_lines_select on payment_voucher_ledger_lines for select
  using (exists (select 1 from payment_vouchers v where v.id = voucher_id and my_role() <> 'sales'));
create policy payment_voucher_ledger_lines_write on payment_voucher_ledger_lines for all
  using (exists (
    select 1 from payment_vouchers v
    where v.id = voucher_id
      and (my_role() in ('owner', 'manager') or v.recorded_by = auth.uid())
  ))
  with check (exists (
    select 1 from payment_vouchers v
    where v.id = voucher_id
      and (my_role() in ('owner', 'manager') or v.recorded_by = auth.uid())
  ));
