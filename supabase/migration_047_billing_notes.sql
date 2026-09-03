-- Backs 3 separate sidebar menus (ใบวางบิล / ใบกำกับภาษี / ใบเสร็จรับเงิน)
-- with one shared schema, distinguished by doc_type. Each document bundles
-- a customer's already-invoiced WALLPOD Project Sales payment installments
-- (snapshotted into billing_note_items) into one billing/tax/receipt
-- document, with document-level discount/WHT%/retention% deductions.

create table billing_notes (
  id uuid primary key default gen_random_uuid(),
  doc_no text not null unique,
  customer_id uuid not null references customers(id),
  doc_date date not null default current_date,
  credit_days int not null default 0,
  due_date date not null,
  sales_rep_id uuid references sales_reps(id),
  doc_type text not null check (doc_type in ('billing_note', 'tax_invoice', 'receipt')),
  discount_amount numeric(14,2) not null default 0,
  wht_percent numeric(5,2) not null default 0,
  retention_percent numeric(5,2) not null default 0,
  note text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table billing_note_items (
  id uuid primary key default gen_random_uuid(),
  billing_note_id uuid not null references billing_notes(id) on delete cascade,
  payment_id uuid references payments(id) on delete set null,
  invoice_no_snapshot text not null,
  invoice_date_snapshot date,
  amount numeric(14,2) not null
);

alter table billing_notes enable row level security;
alter table billing_note_items enable row level security;

create policy billing_notes_select on billing_notes for select using (my_role() <> 'sales');
create policy billing_notes_insert on billing_notes for insert with check (my_role() <> 'sales');
create policy billing_notes_delete on billing_notes for delete using (my_role() <> 'sales');

create policy billing_note_items_select on billing_note_items for select using (my_role() <> 'sales');
create policy billing_note_items_insert on billing_note_items for insert with check (my_role() <> 'sales');
