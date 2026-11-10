-- ใบสำคัญรับเงิน / สมุดรายวันรับ (receipt voucher): the accounting journal entry
-- for money received, issued from an existing ใบเสร็จรับเงิน (billing_notes with
-- doc_type 'receipt'). The receipt's customer, description and amount are
-- copied in when the voucher is created, then stored on the voucher itself so
-- editing or deleting the receipt later never changes an issued voucher.

create table receipt_vouchers (
  id uuid primary key default gen_random_uuid(),
  doc_no text not null unique,
  doc_date date not null default current_date,
  -- The receipt this voucher was issued from ("อ้างอิง/Reference"). Kept as a
  -- plain reference plus a snapshot of its doc no. — a deleted receipt leaves
  -- the voucher intact.
  receipt_id uuid references billing_notes(id) on delete set null,
  receipt_no text,
  -- "ผู้ติดต่อ/Contact" — the customer who paid.
  contact_name text not null,
  contact_tax_id text,
  contact_address text,
  -- "ค่าอธิบาย/Description" and "หมายเหตุ/Remark".
  description text,
  note text,
  recorded_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create index receipt_vouchers_doc_date_idx on receipt_vouchers (doc_date desc);
create index receipt_vouchers_receipt_idx on receipt_vouchers (receipt_id);

-- The journal lines (รหัสบัญชี / ชื่อบัญชี / เดบิต / เครดิต).
create table receipt_voucher_lines (
  id uuid primary key default gen_random_uuid(),
  voucher_id uuid not null references receipt_vouchers(id) on delete cascade,
  account_code text,
  account_name text,
  debit numeric(14,2) not null default 0,
  credit numeric(14,2) not null default 0,
  sort_order int not null default 0
);

create index receipt_voucher_lines_voucher_idx on receipt_voucher_lines (voucher_id);

alter table receipt_vouchers enable row level security;
alter table receipt_voucher_lines enable row level security;

create policy receipt_vouchers_select on receipt_vouchers for select
  using (my_role() <> 'sales');
create policy receipt_vouchers_write on receipt_vouchers for all
  using (my_role() in ('owner', 'manager', 'account', 'support_sale'))
  with check (my_role() in ('owner', 'manager', 'account', 'support_sale'));

create policy receipt_voucher_lines_select on receipt_voucher_lines for select
  using (my_role() <> 'sales');
create policy receipt_voucher_lines_write on receipt_voucher_lines for all
  using (my_role() in ('owner', 'manager', 'account', 'support_sale'))
  with check (my_role() in ('owner', 'manager', 'account', 'support_sale'));
