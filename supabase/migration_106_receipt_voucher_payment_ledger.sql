-- The ใบสำคัญรับเงิน print now follows the ใบสำคัญจ่าย layout, which carries the
-- bank/account/date the money came in through and a small ledger (รหัสบัญชี /
-- รายการ / DEBIT / CREDIT) — so a receipt voucher stores both, like a payment
-- voucher does.

alter table receipt_vouchers
  add column if not exists bank_name text,
  add column if not exists bank_account_no text,
  add column if not exists pay_date date;

create table receipt_voucher_ledger_lines (
  id uuid primary key default gen_random_uuid(),
  voucher_id uuid not null references receipt_vouchers(id) on delete cascade,
  account_code text,
  description text,
  debit numeric(14,2) not null default 0,
  credit numeric(14,2) not null default 0,
  sort_order int not null default 0
);

create index receipt_voucher_ledger_lines_voucher_idx on receipt_voucher_ledger_lines (voucher_id);

alter table receipt_voucher_ledger_lines enable row level security;

create policy receipt_voucher_ledger_lines_select on receipt_voucher_ledger_lines for select
  using (my_role() <> 'sales');
create policy receipt_voucher_ledger_lines_write on receipt_voucher_ledger_lines for all
  using (my_role() in ('owner', 'manager', 'account', 'support_sale'))
  with check (my_role() in ('owner', 'manager', 'account', 'support_sale'));
