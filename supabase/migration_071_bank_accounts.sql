-- บัญชีธนาคาร (Bank Accounts) — tracks the company's own bank accounts.
-- ยอดในธนาคาร (actual_balance) and ยอดยกมา (opening_balance) are both
-- manually entered/kept in sync by staff checking the real bank app — this
-- app has no live bank API integration. ยอดในระบบ ("book" balance) is
-- computed on read from opening_balance plus recorded โอนเงิน transactions
-- on receipts/payment vouchers that match this account (see
-- src/lib/data/bank-accounts.ts), not stored here.
create table bank_accounts (
  id uuid primary key default gen_random_uuid(),
  bank_name text not null,
  account_no text not null,
  account_type text not null default 'กระแสรายวัน',
  account_name text not null default 'บริษัท คูนเว จำกัด',
  opening_balance numeric(14,2) not null default 0,
  actual_balance numeric(14,2) not null default 0,
  actual_balance_updated_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (bank_name, account_no)
);
alter table bank_accounts enable row level security;

-- Same tier as Payment Voucher/เงินสดย่อย — core accounting data, not for
-- "sales".
create policy bank_accounts_select on bank_accounts for select using (my_role() <> 'sales');
create policy bank_accounts_write on bank_accounts for all
  using (my_role() in ('owner', 'manager', 'account')) with check (my_role() in ('owner', 'manager', 'account'));

-- Seed the one real account already printed elsewhere in the app (quotations,
-- payment vouchers, receipts' โอนเงิน auto-fill).
insert into bank_accounts (bank_name, account_no, account_type, account_name, opening_balance, actual_balance)
values ('กรุงศรีอยุธยา', '403-0-00726-8', 'กระแสรายวัน', 'บริษัท คูนเว จำกัด', 0, 0)
on conflict (bank_name, account_no) do nothing;
