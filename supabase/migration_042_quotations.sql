-- ใบเสนอราคา (Quotations) — header/customer info, itemized lines with an
-- optional per-line product photo, VAT/grand total, and a freeform payment-
-- terms schedule (deposit/installment/final %, amount derived from the
-- grand total). Same access tier as WALLPOD Project Sales (excludes the
-- narrow "sales" tier) since this feeds into that same accounting-grade
-- ledger once a quote is accepted and converted.

create table quotations (
  id uuid primary key default gen_random_uuid(),
  doc_no text not null unique,
  quote_date date not null default current_date,
  project_name text not null,
  attn text,
  customer_name text not null,
  customer_address text,
  customer_tel text,
  customer_tax_id text,
  job_number text,
  po_number text,
  delivery_date date,
  price_validity text,
  remark text,
  -- Array of {label, percent, amount} — amount is a snapshot computed from
  -- (percent / 100 * grand_total) at save time, not re-derived on read, so
  -- an old quote's printed schedule stays exact even if items change later.
  payment_terms jsonb not null default '[]'::jsonb,
  pre_vat numeric(14,2) not null default 0,
  vat numeric(14,2) not null default 0,
  total numeric(14,2) generated always as (pre_vat + vat) stored,
  sales_rep_id uuid references sales_reps(id),
  status text not null default 'รอตอบรับ' check (status in ('รอตอบรับ', 'ลูกค้าตอบตกลง', 'ปฏิเสธ')),
  converted_project_id uuid references projects(id) on delete set null,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table quotation_items (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null references quotations(id) on delete cascade,
  sort_order int not null default 0,
  product_code text,
  description text not null,
  image_path text,
  unit_price numeric(14,2) not null default 0,
  discount_percent numeric(5,2) not null default 0,
  net_price numeric(14,2) not null default 0,
  qty numeric(14,2) not null default 1,
  unit text not null default 'Pcs.',
  total_price numeric(14,2) not null default 0
);

alter table quotations enable row level security;
alter table quotation_items enable row level security;

create policy quotations_select on quotations for select using (my_role() <> 'sales');
create policy quotations_write on quotations for all
  using (my_role() <> 'sales') with check (my_role() <> 'sales');

create policy quotation_items_select on quotation_items for select
  using (exists (select 1 from quotations q where q.id = quotation_id and my_role() <> 'sales'));
create policy quotation_items_write on quotation_items for all
  using (exists (select 1 from quotations q where q.id = quotation_id and my_role() <> 'sales'));

insert into storage.buckets (id, name, public)
values ('quotation-item-images', 'quotation-item-images', false)
on conflict (id) do nothing;

create policy quotation_item_images_select on storage.objects
  for select using (bucket_id = 'quotation-item-images' and my_role() <> 'sales');

create policy quotation_item_images_insert on storage.objects
  for insert with check (bucket_id = 'quotation-item-images' and my_role() <> 'sales');

create policy quotation_item_images_delete on storage.objects
  for delete using (bucket_id = 'quotation-item-images' and my_role() <> 'sales');
