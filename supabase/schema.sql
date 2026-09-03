-- WALLPOD Owner Dashboard — core schema + RLS
-- Run this once in Supabase Studio > SQL Editor on a fresh project.

create extension if not exists "pgcrypto";

-- ============ Reference tables ============

create table sales_reps (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  profile_id uuid, -- linked once the person has a login (see profiles below)
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  customer_type text not null check (customer_type in
    ('Owner','Designer','Turnkey','Contractor','Corporate','Dealer','School')),
  created_at timestamptz not null default now(),
  contact_person text,
  address text,
  phone text,
  tax_id text
);

-- ============ Auth / roles ============

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null check (role in
    ('owner','manager','sales','design','support_sale','account','foreman','production')),
  sales_rep_id uuid references sales_reps(id),
  department text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table sales_reps
  add constraint sales_reps_profile_fk foreign key (profile_id) references profiles(id);

-- ============ Sales pipeline ============

create table projects (
  id uuid primary key default gen_random_uuid(),
  job_no text unique,
  project_date date not null default current_date,
  customer_id uuid not null references customers(id),
  project_name text not null,
  sales_rep_id uuid not null references sales_reps(id),
  customer_type text not null check (customer_type in
    ('Owner','Designer','Turnkey','Contractor','Corporate','Dealer','School')),
  stage_percent int not null default 10 check (stage_percent in (10,30,50,100)),
  pre_vat numeric(14,2) not null default 0,
  vat numeric(14,2) not null default 0,
  total numeric(14,2) generated always as (pre_vat + vat) stored,
  is_cancelled boolean not null default false,
  production_status text check (production_status in (
    'รอเงินมัดจำ','รออนุมัติแบบ','ทำแบบผลิต (Cutting)','เบิกแผ่น','กำลังผลิต','ผลิตเสร็จ',
    'ส่งของแล้ว','ติดตั้งเสร็จ','รอใบส่งมอบ','จบงาน','เก็บเงินงวดสุดท้าย'
  )),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table project_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  product_category text not null,
  amount numeric(14,2) not null default 0
);

create table project_costs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null unique references projects(id) on delete cascade,
  material_cost numeric(14,2) not null default 0,
  glue_cost numeric(14,2) not null default 0,
  cutting_cost numeric(14,2) not null default 0,
  install_cost numeric(14,2) not null default 0,
  parking_cost numeric(14,2) not null default 0,
  shipping_cost numeric(14,2) not null default 0,
  total_cost numeric(14,2) generated always as
    (material_cost + glue_cost + cutting_cost + install_cost + parking_cost + shipping_cost) stored
);

create table payments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  invoice_no text,
  installment_no int not null default 1,
  amount numeric(14,2) not null default 0,
  paid_date date,
  status text not null check (status in
    ('เก็บเงินเรียบร้อย','ชำระมาแล้ว 50%','รอชำระเงิน')),
  outstanding_amount numeric(14,2) not null default 0,
  -- An installment counts as actually paid only once this is filled in —
  -- invoice_no alone can be entered before the money has actually arrived.
  receipt_no text,
  -- paid_date above is really "document/invoice issue date"; this is the
  -- actual date money was received, paired with receipt_no the same way
  -- paid_date is paired with invoice_no.
  received_date date,
  -- Earlier still in the same sequence (ใบวางบิล -> invoice -> receipt).
  billing_note_no text,
  billing_note_date date
);

-- ============ Sale Report (live pipeline tracking, self-reported by sales reps) ============

create table sales_leads (
  id uuid primary key default gen_random_uuid(),
  sales_rep_id uuid not null references sales_reps(id),
  customer_name text not null,
  project_name text,
  customer_type text not null check (customer_type in
    ('Owner','Designer','Turnkey','Contractor','Corporate','Dealer','School')),
  project_type text not null check (project_type in
    ('ออฟฟิศ','โรงแรม','โรงเรียน','โรงพยาบาล','บ้าน','คอนโด','ห้องซ้อมดนตรี','อื่นๆ')),
  stage text not null check (stage in
    ('นำเสนอ','ใบเสนอราคา','เจรจาต่อรอง','ปิดการขาย','ไม่สำเร็จ')),
  stage_percent int not null check (stage_percent in (0, 10, 30, 50, 100)),
  est_value numeric(14,2) not null default 0,
  location_text text,
  next_action text,
  note text,
  phone text,
  contact_name text,
  image_paths text[] not null default '{}',
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

-- ============ Helper functions (security definer to avoid RLS recursion) ============

create or replace function my_role() returns text
language sql security definer stable as $$
  select role from profiles where id = auth.uid()
$$;

create or replace function my_sales_rep_id() returns uuid
language sql security definer stable as $$
  select sales_rep_id from profiles where id = auth.uid()
$$;

-- ============ RLS ============

alter table profiles enable row level security;
alter table sales_reps enable row level security;
alter table customers enable row level security;
alter table projects enable row level security;
alter table project_items enable row level security;
alter table project_costs enable row level security;
alter table payments enable row level security;
alter table sales_leads enable row level security;

-- profiles: everyone can read their own row; owner/manager read all
create policy profiles_select on profiles for select
  using (id = auth.uid() or my_role() in ('owner','manager'));
create policy profiles_insert on profiles for insert
  with check (my_role() = 'owner');

-- sales_reps / customers: all logged-in staff can read (needed for dropdowns/labels)
create policy sales_reps_select on sales_reps for select using (auth.uid() is not null);
create policy customers_select on customers for select using (auth.uid() is not null);
create policy sales_reps_write on sales_reps for all
  using (my_role() in ('owner','manager')) with check (my_role() in ('owner','manager'));
create policy customers_write on customers for all
  using (my_role() in ('owner','manager','support_sale')) with check (my_role() in ('owner','manager','support_sale'));

-- projects: any authenticated user can read (Sales Dashboard's rep-
-- performance chart is meant to compare every rep, so 'sales' isn't scoped
-- to their own rows here — unlike sales_leads, which IS scoped). Write
-- access excludes both 'sales' and 'design' (Designer is view-only across
-- the app; everyone else who could already write keeps that) — sales stays
-- unable to create/edit WALLPOD Project Sales even though they can read it.
create policy projects_select on projects for select using (auth.uid() is not null);
create policy projects_write on projects for all
  using (my_role() not in ('sales','design')) with check (my_role() not in ('sales','design'));

-- child tables inherit visibility from their parent project
create policy project_items_select on project_items for select using (auth.uid() is not null);
create policy project_items_write on project_items for all
  using (exists (select 1 from projects p where p.id = project_id and my_role() not in ('sales','design')));

create policy project_costs_select on project_costs for select
  using (my_role() in ('owner','manager'));
create policy project_costs_write on project_costs for all
  using (my_role() in ('owner','manager'));

create policy payments_select on payments for select using (auth.uid() is not null);
create policy payments_write on payments for all using (my_role() not in ('sales','design'));

create policy sales_leads_select on sales_leads for select
  using (my_role() in ('owner','manager') or sales_rep_id = my_sales_rep_id());
create policy sales_leads_write on sales_leads for all
  using (my_role() in ('owner','manager') or sales_rep_id = my_sales_rep_id())
  with check (my_role() in ('owner','manager') or sales_rep_id = my_sales_rep_id());

-- ============ Sale Report photo attachments (private Storage bucket) ============

insert into storage.buckets (id, name, public)
values ('sale-report-images', 'sale-report-images', false)
on conflict (id) do nothing;

create policy sale_report_images_select on storage.objects
  for select using (
    bucket_id = 'sale-report-images'
    and (my_role() in ('owner','manager')
         or (storage.foldername(name))[1]::uuid = my_sales_rep_id())
  );

create policy sale_report_images_insert on storage.objects
  for insert with check (
    bucket_id = 'sale-report-images'
    and (my_role() in ('owner','manager')
         or (storage.foldername(name))[1]::uuid = my_sales_rep_id())
  );

create policy sale_report_images_delete on storage.objects
  for delete using (
    bucket_id = 'sale-report-images'
    and (my_role() in ('owner','manager')
         or (storage.foldername(name))[1]::uuid = my_sales_rep_id())
  );

-- ============ Sale Report edit/delete audit log ============

create table sales_lead_change_log (
  id uuid primary key default gen_random_uuid(),
  sale_lead_id uuid references sales_leads(id) on delete set null,
  action text not null check (action in ('update', 'delete')),
  sales_rep_id uuid not null references sales_reps(id),
  customer_name text not null,
  changed_by uuid references profiles(id),
  before_snapshot jsonb not null,
  created_at timestamptz not null default now()
);

alter table sales_lead_change_log enable row level security;

create policy sales_lead_change_log_select on sales_lead_change_log for select
  using (my_role() in ('owner','manager') or sales_rep_id = my_sales_rep_id());

create policy sales_lead_change_log_insert on sales_lead_change_log for insert
  with check (my_role() in ('owner','manager') or sales_rep_id = my_sales_rep_id());

-- ============ Stock / Inventory ============

create table stock_products (
  id uuid primary key default gen_random_uuid(),
  sku text,
  name text not null,
  category text,
  color text,
  size text,
  thickness text,
  location text,
  note text,
  unit text not null default 'ชิ้น',
  quantity_on_hand numeric(14,2) not null default 0,
  reorder_point numeric(14,2) not null default 0,
  unit_cost numeric(14,2) not null default 0,
  selling_price numeric(14,2),
  image_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table stock_movements (
  id uuid primary key default gen_random_uuid(),
  stock_product_id uuid not null references stock_products(id) on delete cascade,
  movement_type text not null check (movement_type in ('in', 'out')),
  quantity numeric(14,2) not null,
  note text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  balance_before numeric(14,2),
  balance_after numeric(14,2),
  reference_no text
);

alter table stock_products enable row level security;
alter table stock_movements enable row level security;

create policy stock_products_select on stock_products for select using (auth.uid() is not null);
-- Insert (add a new product) is open to support_sale/account too; update/
-- delete stay owner/manager only — "can add, cannot edit".
create policy stock_products_insert on stock_products for insert
  with check (my_role() in ('owner','manager','support_sale','account'));
create policy stock_products_update on stock_products for update
  using (my_role() in ('owner','manager')) with check (my_role() in ('owner','manager'));
create policy stock_products_delete on stock_products for delete
  using (my_role() in ('owner','manager'));

create policy stock_movements_select on stock_movements for select using (my_role() <> 'sales');
create policy stock_movements_insert on stock_movements for insert
  with check (my_role() in ('owner','manager','production'));

create function record_stock_movement(
  p_product_id uuid, p_type text, p_qty numeric, p_note text, p_reference text default null
)
returns void language plpgsql security definer as $$
declare
  v_before numeric(14,2);
  v_after numeric(14,2);
begin
  if my_role() not in ('owner', 'manager', 'production') then
    raise exception 'permission denied';
  end if;

  select quantity_on_hand into v_before from stock_products where id = p_product_id;
  v_after := v_before + (case when p_type = 'in' then p_qty else -p_qty end);

  insert into stock_movements (stock_product_id, movement_type, quantity, note, created_by, balance_before, balance_after, reference_no)
  values (p_product_id, p_type, p_qty, p_note, auth.uid(), v_before, v_after, p_reference);

  update stock_products
  set quantity_on_hand = v_after, updated_at = now()
  where id = p_product_id;
end;
$$;

-- ============ Stock Product photo (private Storage bucket) ============
-- Mirrors stock_products table RLS exactly (role-based, not folder-owned —
-- stock products have no owning sales rep, unlike sale-report-images).

insert into storage.buckets (id, name, public)
values ('stock-product-images', 'stock-product-images', false)
on conflict (id) do nothing;

create policy stock_product_images_select on storage.objects
  for select using (
    bucket_id = 'stock-product-images'
    and auth.uid() is not null
  );

create policy stock_product_images_insert on storage.objects
  for insert with check (
    bucket_id = 'stock-product-images'
    and my_role() in ('owner','manager')
  );

create policy stock_product_images_delete on storage.objects
  for delete using (
    bucket_id = 'stock-product-images'
    and my_role() in ('owner','manager')
  );

-- ============ Product Categories (manageable list, replaces hardcoded enum) ============

create table product_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  created_at timestamptz not null default now()
);

alter table product_categories enable row level security;

create policy product_categories_select on product_categories for select using (my_role() <> 'sales');
-- Same "can add, cannot edit" split as stock_products.
create policy product_categories_insert on product_categories for insert
  with check (my_role() in ('owner','manager','support_sale','account'));
create policy product_categories_update on product_categories for update
  using (my_role() in ('owner','manager')) with check (my_role() in ('owner','manager'));
create policy product_categories_delete on product_categories for delete
  using (my_role() in ('owner','manager'));

insert into product_categories (name) values
  ('WALLPOD'),('ACOUSHEET'),('ACOUSOFT'),('ACUBOX'),('CNC'),('SERVICE'),('WALLPAPER'),('OTHER')
on conflict (name) do nothing;

-- ============ Stock Requisitions (ใบเบิกสินค้า) ============

create table departments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

alter table departments enable row level security;

create policy departments_select on departments for select using (auth.uid() is not null);
create policy departments_write on departments for all
  using (my_role() in ('owner','manager')) with check (my_role() in ('owner','manager'));

insert into departments (name) values ('Administration');

create table stock_requisitions (
  id uuid primary key default gen_random_uuid(),
  doc_no text not null unique,
  department_id uuid references departments(id),
  requested_by uuid references profiles(id),
  job_no text,
  project_name text,
  purpose text not null check (purpose in ('production','sample')),
  customer_id uuid references customers(id),
  note text,
  status text not null default 'อนุมัติแล้ว',
  created_at timestamptz not null default now()
);

create table stock_requisition_items (
  id uuid primary key default gen_random_uuid(),
  requisition_id uuid not null references stock_requisitions(id) on delete cascade,
  stock_product_id uuid references stock_products(id) on delete set null,
  product_name_snapshot text not null,
  product_sku_snapshot text,
  unit_snapshot text not null default 'ชิ้น',
  quantity numeric(14,2) not null,
  unit_cost numeric(14,2) not null default 0
);

alter table stock_requisitions enable row level security;
alter table stock_requisition_items enable row level security;

create policy stock_requisitions_select on stock_requisitions for select using (my_role() <> 'sales');
create policy stock_requisitions_insert on stock_requisitions for insert
  with check (my_role() in ('owner','manager','production','support_sale','account'));
create policy stock_requisitions_delete on stock_requisitions for delete
  using (my_role() in ('owner','manager') or requested_by = auth.uid());
create policy stock_requisitions_update on stock_requisitions for update
  using (my_role() in ('owner','manager') or requested_by = auth.uid())
  with check (my_role() in ('owner','manager') or requested_by = auth.uid());

create policy stock_requisition_items_select on stock_requisition_items for select using (my_role() <> 'sales');
create policy stock_requisition_items_insert on stock_requisition_items for insert
  with check (my_role() in ('owner','manager','production','support_sale','account'));
create policy stock_requisition_items_delete on stock_requisition_items for delete
  using (exists (
    select 1 from stock_requisitions sr
    where sr.id = requisition_id and (my_role() in ('owner','manager') or sr.requested_by = auth.uid())
  ));

-- ============ User Permissions (ผู้ใช้งาน) ============
-- profiles previously had no update policy at all; only owner may edit anyone's row
-- (view/edit-role only — no service-role key, no account creation, no password reset).

create policy profiles_update on profiles for update
  using (my_role() = 'owner') with check (my_role() = 'owner');

-- Exposes auth.users email without the service-role key or auth.admin.* APIs —
-- runs inside Postgres as security definer, gated to owner internally, same
-- proven shape as record_stock_movement's role check.
create function get_user_emails()
returns table(id uuid, email text)
language plpgsql security definer as $$
begin
  if my_role() <> 'owner' then
    raise exception 'permission denied';
  end if;
  return query select au.id, au.email::text from auth.users au;
end;
$$;

-- ============ Goods Receipt (รับเข้าสินค้า) ============

create table suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  address text,
  tax_id text,
  branch text,
  created_at timestamptz not null default now()
);
alter table suppliers enable row level security;
create policy suppliers_select on suppliers for select using (auth.uid() is not null);
create policy suppliers_write on suppliers for all
  using (my_role() in ('owner','manager')) with check (my_role() in ('owner','manager'));

create table goods_receipts (
  id uuid primary key default gen_random_uuid(),
  doc_no text not null unique,
  supplier_id uuid references suppliers(id),
  received_by uuid references profiles(id),
  reference_no text,
  note text,
  created_at timestamptz not null default now(),
  payment_status text not null default 'ยังไม่จ่าย' check (payment_status in ('จ่ายแล้ว', 'ยังไม่จ่าย')),
  paid_date date
);

create table goods_receipt_items (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references goods_receipts(id) on delete cascade,
  stock_product_id uuid references stock_products(id) on delete set null,
  product_name_snapshot text not null,
  product_sku_snapshot text,
  unit_snapshot text not null default 'ชิ้น',
  quantity numeric(14,2) not null,
  unit_cost numeric(14,2) not null
);

alter table goods_receipts enable row level security;
alter table goods_receipt_items enable row level security;

create policy goods_receipts_select on goods_receipts for select using (my_role() <> 'sales');
create policy goods_receipts_insert on goods_receipts for insert
  with check (my_role() in ('owner','manager','production','support_sale','account'));
-- Delete requires the 'production' role specifically for the self-service
-- clause (not just any owner of the row) — otherwise support_sale/account
-- would gain delete on receipts they just created, contradicting "can add,
-- cannot edit/delete".
create policy goods_receipts_delete on goods_receipts for delete
  using (my_role() in ('owner','manager') or (my_role() = 'production' and received_by = auth.uid()));

create policy goods_receipt_items_select on goods_receipt_items for select using (my_role() <> 'sales');
create policy goods_receipt_items_insert on goods_receipt_items for insert
  with check (my_role() in ('owner','manager','production','support_sale','account'));

-- New, separate RPC — does not modify record_stock_movement, which is used by
-- flows that never asked to carry a cost basis (Stock Product quick-entry
-- Sheet, Low Stock Alert's Record IN, Stock Requisition's deduction). Only a
-- formal goods receipt recalculates the weighted-average unit_cost.
create function record_goods_receipt(
  p_product_id uuid, p_qty numeric, p_unit_cost numeric, p_note text, p_reference text default null
)
returns void language plpgsql security definer as $$
declare
  v_before numeric(14,2);
  v_after numeric(14,2);
  v_old_cost numeric(14,2);
  v_new_avg_cost numeric(14,2);
begin
  if my_role() not in ('owner', 'manager', 'production') then
    raise exception 'permission denied';
  end if;

  select quantity_on_hand, unit_cost into v_before, v_old_cost from stock_products where id = p_product_id;
  v_after := v_before + p_qty;

  v_new_avg_cost := case
    when v_after = 0 then v_old_cost
    else ((v_before * v_old_cost) + (p_qty * p_unit_cost)) / v_after
  end;

  insert into stock_movements (stock_product_id, movement_type, quantity, note, created_by, balance_before, balance_after, reference_no)
  values (p_product_id, 'in', p_qty, p_note, auth.uid(), v_before, v_after, p_reference);

  update stock_products
  set quantity_on_hand = v_after, unit_cost = v_new_avg_cost, updated_at = now()
  where id = p_product_id;
end;
$$;

create policy goods_receipts_update on goods_receipts for update
  using (my_role() in ('owner','manager','account') or (my_role() = 'production' and received_by = auth.uid()))
  with check (my_role() in ('owner','manager','account') or (my_role() = 'production' and received_by = auth.uid()));

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

create policy goods_receipt_items_delete on goods_receipt_items for delete
  using (exists (
    select 1 from goods_receipts gr
    where gr.id = receipt_id
      and (my_role() in ('owner','manager') or (my_role() = 'production' and gr.received_by = auth.uid()))
  ));

-- Edits reverse the line's original (qty, cost) contribution against the
-- product's CURRENT stock state, then apply the edited one — same
-- weighted-average formula as record_goods_receipt, run twice. Passing
-- p_old_qty=0 (new line) or p_new_qty=0 (removed line) skips the matching
-- half cleanly. Deliberately separate from record_goods_receipt so create
-- and edit stay on independent code paths.
create function edit_goods_receipt_item(
  p_product_id uuid, p_old_qty numeric, p_old_cost numeric,
  p_new_qty numeric, p_new_cost numeric, p_note text, p_reference text default null
)
returns void language plpgsql security definer as $$
declare
  v_before numeric(14,2);
  v_cost numeric(14,2);
  v_after_reverse numeric(14,2);
  v_after numeric(14,2);
begin
  if my_role() not in ('owner', 'manager', 'production') then
    raise exception 'permission denied';
  end if;

  select quantity_on_hand, unit_cost into v_before, v_cost from stock_products where id = p_product_id;

  v_after_reverse := v_before - p_old_qty;
  v_cost := case when v_after_reverse <= 0 then v_cost
                 else ((v_before * v_cost) - (p_old_qty * p_old_cost)) / v_after_reverse end;

  v_after := v_after_reverse + p_new_qty;
  v_cost := case when v_after = 0 then v_cost
                  else ((v_after_reverse * v_cost) + (p_new_qty * p_new_cost)) / v_after end;

  insert into stock_movements (stock_product_id, movement_type, quantity, note, created_by, balance_before, balance_after, reference_no)
  values (p_product_id, case when p_new_qty >= p_old_qty then 'in' else 'out' end,
          abs(p_new_qty - p_old_qty), p_note, auth.uid(), v_before, v_after, p_reference);

  update stock_products set quantity_on_hand = v_after, unit_cost = v_cost, updated_at = now()
  where id = p_product_id;
end;
$$;
-- NOTE: superseded by the create-or-replace at the bottom of this file
-- (migration_022), which adds stock_product_lots syncing. Left in place
-- above unchanged since fresh installs execute top-to-bottom and the later
-- definition is what actually takes effect.

-- Atomic full-replace for the WALLPOD Project Sales ledger. A Postgres
-- function body is implicitly one transaction: if any insert in the loop
-- raises, EVERYTHING in this call rolls back, including the earlier
-- delete — so a bad row can never leave the database half-wiped. Only
-- projects/project_items/project_costs/payments are touched; customers
-- and sales_reps (shared with Sale Report, Stock Requisition, and real
-- login accounts via sales_reps.profile_id) are never deleted here.
create function replace_all_projects(p_rows jsonb)
returns int language plpgsql security definer as $$
declare
  v_row jsonb;
  v_project_id uuid;
  v_count int := 0;
begin
  -- coalesce, not a bare `<>` comparison: my_role() returns NULL when
  -- there's no matching profile (e.g. this RPC called via the service-role
  -- key with no impersonated user), and `NULL <> 'owner'` evaluates to
  -- NULL, which `if` treats as false — silently bypassing this check for
  -- the single most destructive RPC in the app. coalesce() closes that.
  if coalesce(my_role(), '') <> 'owner' then
    raise exception 'permission denied';
  end if;

  delete from projects; -- cascades project_items, project_costs, payments

  for v_row in select * from jsonb_array_elements(p_rows)
  loop
    insert into projects (job_no, project_date, customer_id, project_name, sales_rep_id, customer_type, stage_percent, pre_vat, vat, production_status)
    values (
      nullif(v_row->>'jobNo', ''), (v_row->>'projectDate')::date, (v_row->>'customerId')::uuid,
      v_row->>'projectName', (v_row->>'salesRepId')::uuid, v_row->>'customerType', 100,
      (v_row->>'preVat')::numeric, (v_row->>'vat')::numeric, nullif(v_row->>'productionStatus', '')
    )
    returning id into v_project_id;

    insert into project_items (project_id, product_category, amount)
    select v_project_id, item->>'category', (item->>'amount')::numeric
    from jsonb_array_elements(v_row->'items') as item;

    if jsonb_typeof(v_row->'costs') = 'object' then
      insert into project_costs (project_id, material_cost, glue_cost, cutting_cost, install_cost, parking_cost, shipping_cost)
      values (
        v_project_id, (v_row->'costs'->>'material')::numeric, (v_row->'costs'->>'glue')::numeric,
        (v_row->'costs'->>'cutting')::numeric, (v_row->'costs'->>'install')::numeric,
        (v_row->'costs'->>'parking')::numeric, (v_row->'costs'->>'shipping')::numeric
      );
    end if;

    if jsonb_array_length(coalesce(v_row->'payments', '[]'::jsonb)) > 0 then
      insert into payments (project_id, invoice_no, installment_no, amount, paid_date, status, outstanding_amount, receipt_no, received_date)
      select v_project_id, nullif(p->>'invoiceNo', ''), (p->>'installmentNo')::int, (p->>'amount')::numeric,
             nullif(p->>'paidDate', '')::date, p->>'status', (p->>'outstandingAmount')::numeric,
             nullif(p->>'receiptNo', ''), nullif(p->>'receivedDate', '')::date
      from jsonb_array_elements(v_row->'payments') as p;
    end if;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- ============ Stock Product Lots (view-only lot/batch quantity tracking) ============
-- Each Goods Receipt line creates one lot row here, carrying its own unit_cost
-- (separate from stock_products.unit_cost, which stays the blended weighted
-- average used for reporting). "out" movements consume lots oldest-first
-- (FIFO) automatically so quantity_remaining stays accurate — but this is
-- purely for visibility: no flow ever asks the user to pick a lot.
--
-- Legacy stock recorded before this feature existed (the original Excel
-- import, and any "in" movement/adjustment that isn't a goods receipt) has no
-- lot of origin, so a product's lot totals may be less than its
-- quantity_on_hand — the UI must treat that gap as "unspecified lot", not a
-- bug.
--
-- Known, accepted limitation (same class as goods receipt delete/edit's
-- existing documented gaps): editing or deleting a goods receipt does NOT
-- retroactively adjust the lot row it created — edit works per-product
-- aggregate (see edit_goods_receipt_item), not per line, so there is no
-- single lot to safely re-target. The lot stays as originally received.

create table stock_product_lots (
  id uuid primary key default gen_random_uuid(),
  stock_product_id uuid not null references stock_products(id) on delete cascade,
  quantity_received numeric(14,2) not null,
  quantity_remaining numeric(14,2) not null,
  unit_cost numeric(14,2) not null,
  reference_no text,
  received_at timestamptz not null default now()
);

alter table stock_product_lots enable row level security;

create policy stock_product_lots_select on stock_product_lots for select using (my_role() <> 'sales');
-- No insert/update/delete policy: only ever mutated by record_goods_receipt /
-- record_stock_movement below, both security definer.

-- Same signature as before — adds one insert at the end, no drop needed.
create or replace function record_goods_receipt(
  p_product_id uuid, p_qty numeric, p_unit_cost numeric, p_note text, p_reference text default null
)
returns void language plpgsql security definer as $$
declare
  v_before numeric(14,2);
  v_after numeric(14,2);
  v_old_cost numeric(14,2);
  v_new_avg_cost numeric(14,2);
begin
  if my_role() not in ('owner', 'manager', 'production', 'support_sale', 'account') then
    raise exception 'permission denied';
  end if;

  select quantity_on_hand, unit_cost into v_before, v_old_cost from stock_products where id = p_product_id;
  v_after := v_before + p_qty;

  v_new_avg_cost := case
    when v_after = 0 then v_old_cost
    else ((v_before * v_old_cost) + (p_qty * p_unit_cost)) / v_after
  end;

  insert into stock_movements (stock_product_id, movement_type, quantity, note, created_by, balance_before, balance_after, reference_no)
  values (p_product_id, 'in', p_qty, p_note, auth.uid(), v_before, v_after, p_reference);

  update stock_products
  set quantity_on_hand = v_after, unit_cost = v_new_avg_cost, updated_at = now()
  where id = p_product_id;

  insert into stock_product_lots (stock_product_id, quantity_received, quantity_remaining, unit_cost, reference_no)
  values (p_product_id, p_qty, p_qty, p_unit_cost, p_reference);
end;
$$;

-- Same signature as before — adds FIFO lot consumption on 'out' movements
-- (oldest lot first), no drop needed. Every existing "out" caller (Stock
-- Product quick-entry Sheet, Low Stock Alert's Record IN, Stock Requisition
-- deduction) gets this for free with no call-site changes.
create or replace function record_stock_movement(
  p_product_id uuid, p_type text, p_qty numeric, p_note text, p_reference text default null
)
returns void language plpgsql security definer as $$
declare
  v_before numeric(14,2);
  v_after numeric(14,2);
  v_remaining numeric(14,2);
  v_lot record;
  v_consume numeric(14,2);
begin
  if my_role() not in ('owner', 'manager', 'production', 'support_sale', 'account') then
    raise exception 'permission denied';
  end if;

  select quantity_on_hand into v_before from stock_products where id = p_product_id;
  v_after := v_before + (case when p_type = 'in' then p_qty else -p_qty end);

  insert into stock_movements (stock_product_id, movement_type, quantity, note, created_by, balance_before, balance_after, reference_no)
  values (p_product_id, p_type, p_qty, p_note, auth.uid(), v_before, v_after, p_reference);

  update stock_products
  set quantity_on_hand = v_after, updated_at = now()
  where id = p_product_id;

  if p_type = 'out' then
    v_remaining := p_qty;
    for v_lot in
      select id, quantity_remaining from stock_product_lots
      where stock_product_id = p_product_id and quantity_remaining > 0
      order by received_at asc
      for update
    loop
      exit when v_remaining <= 0;
      v_consume := least(v_lot.quantity_remaining, v_remaining);
      update stock_product_lots set quantity_remaining = quantity_remaining - v_consume where id = v_lot.id;
      v_remaining := v_remaining - v_consume;
    end loop;
  end if;
end;
$$;

-- Syncs stock_product_lots when a goods receipt is edited — closes the
-- "known, accepted limitation" documented in migration_021: since a product
-- can appear at most once per receipt (enforced by the app, Phase 19), the
-- pair (stock_product_id, reference_no = doc_no) uniquely identifies the lot
-- a given receipt line created. That makes a precise, direct update possible
-- (unlike the aggregate stock_products row, which has no such per-line key).
--
-- On edit: find the lot by (product, doc_no). If found, preserve however
-- much of it has already been consumed by later "out" movements
-- (quantity_received - quantity_remaining) and resize both fields around
-- the edited quantity/cost. If not found (a line newly added during the
-- edit), insert a fresh lot. If the edited quantity is 0 (line removed),
-- the lot's remaining is zeroed — it simply stops appearing in the
-- (quantity_remaining > 0) view, same as any other fully-consumed lot.

create or replace function edit_goods_receipt_item(
  p_product_id uuid, p_old_qty numeric, p_old_cost numeric,
  p_new_qty numeric, p_new_cost numeric, p_note text, p_reference text default null
)
returns void language plpgsql security definer as $$
declare
  v_before numeric(14,2);
  v_cost numeric(14,2);
  v_after_reverse numeric(14,2);
  v_after numeric(14,2);
  v_lot record;
  v_consumed numeric(14,2);
begin
  if my_role() not in ('owner', 'manager', 'production') then
    raise exception 'permission denied';
  end if;

  select quantity_on_hand, unit_cost into v_before, v_cost from stock_products where id = p_product_id;

  v_after_reverse := v_before - p_old_qty;
  v_cost := case when v_after_reverse <= 0 then v_cost
                 else ((v_before * v_cost) - (p_old_qty * p_old_cost)) / v_after_reverse end;

  v_after := v_after_reverse + p_new_qty;
  v_cost := case when v_after = 0 then v_cost
                  else ((v_after_reverse * v_cost) + (p_new_qty * p_new_cost)) / v_after end;

  insert into stock_movements (stock_product_id, movement_type, quantity, note, created_by, balance_before, balance_after, reference_no)
  values (p_product_id, case when p_new_qty >= p_old_qty then 'in' else 'out' end,
          abs(p_new_qty - p_old_qty), p_note, auth.uid(), v_before, v_after, p_reference);

  update stock_products set quantity_on_hand = v_after, unit_cost = v_cost, updated_at = now()
  where id = p_product_id;

  if p_reference is not null then
    select id, quantity_received, quantity_remaining into v_lot
    from stock_product_lots
    where stock_product_id = p_product_id and reference_no = p_reference
    limit 1;

    if v_lot.id is not null then
      v_consumed := v_lot.quantity_received - v_lot.quantity_remaining;
      update stock_product_lots
      set quantity_received = p_new_qty,
          quantity_remaining = greatest(0, p_new_qty - v_consumed),
          unit_cost = p_new_cost
      where id = v_lot.id;
    elsif p_new_qty > 0 then
      insert into stock_product_lots (stock_product_id, quantity_received, quantity_remaining, unit_cost, reference_no)
      values (p_product_id, p_new_qty, p_new_qty, p_new_cost, p_reference);
    end if;
  end if;
end;
$$;

-- ============ Login activity log (เก็บ log การใช้งาน) ============
-- Append-only: no update/delete policy, matching sales_lead_change_log's
-- precedent — insert restricted to logging your own login, select
-- restricted to owner (this is who-logged-in-when, sensitive to the same
-- degree as the ผู้ใช้งาน page it now sits next to in the sidebar).

create table login_log (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id) on delete set null,
  full_name_snapshot text not null,
  email text,
  logged_in_at timestamptz not null default now()
);

alter table login_log enable row level security;

create policy login_log_select on login_log for select
  using (my_role() in ('owner','manager'));

create policy login_log_insert on login_log for insert
  with check (profile_id = auth.uid());

-- ============ Significant-action activity log ============
-- Separate from login_log (who logged in when) — this tracks who did
-- something risky (delete, permission change, account change) and what.
-- Append-only: no update/delete policy, same shape as login_log/
-- sales_lead_change_log. Insert restricted to logging your own action,
-- select restricted to owner.

create table activity_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references profiles(id) on delete set null,
  actor_name_snapshot text not null,
  action text not null,
  entity_label text,
  created_at timestamptz not null default now()
);

alter table activity_log enable row level security;

create policy activity_log_select on activity_log for select
  using (my_role() in ('owner','manager'));

create policy activity_log_insert on activity_log for insert
  with check (actor_id = auth.uid());

-- ============ ค่าใช้จ่าย (Expenses): Payment Voucher + เงินสดย่อย ============
-- Same tier as Stock Requisition/Goods Receipt: Sale tier denied entirely
-- (this is cost/financial data), Staff+Admin can read, and write is
-- widened to the 'account' role specifically (this app's dedicated
-- accounting role) alongside owner/manager — mirrors how 'production' was
-- added to stock-movement write access for the same reason.

-- ---------- Payment Voucher (ใบสำคัญจ่าย) ----------
-- A flat record per outgoing payment — full CRUD (unlike petty cash below,
-- there's no running balance to protect, so edit/delete are safe and useful
-- here, matching goods_receipts/stock_requisitions' precedent).
create table payment_vouchers (
  id uuid primary key default gen_random_uuid(),
  doc_no text not null unique,
  voucher_date date not null default current_date,
  payee_name text not null,
  category text,
  amount numeric(14,2) not null,
  payment_method text,
  reference_no text,
  note text,
  recorded_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  wht_cert_no text,
  description text,
  wht_rate numeric(5,2),
  wht_form_type text check (wht_form_type in ('ภ.ง.ด.1', 'ภ.ง.ด.2', 'ภ.ง.ด.3', 'ภ.ง.ด.53')),
  wht_amount numeric(14,2) not null default 0,
  bank_name text,
  bank_account_no text,
  bank_transfer_date date,
  job_no text
);

alter table payment_vouchers enable row level security;

create policy payment_vouchers_select on payment_vouchers for select
  using (my_role() <> 'sales');
create policy payment_vouchers_insert on payment_vouchers for insert
  with check (my_role() in ('owner', 'manager', 'account'));
-- account gets full parity with owner/manager here (not just its own
-- vouchers) — "full add/edit/delete access to the Expenses menu".
create policy payment_vouchers_update on payment_vouchers for update
  using (my_role() in ('owner', 'manager', 'account') or recorded_by = auth.uid())
  with check (my_role() in ('owner', 'manager', 'account') or recorded_by = auth.uid());
create policy payment_vouchers_delete on payment_vouchers for delete
  using (my_role() in ('owner', 'manager', 'account') or recorded_by = auth.uid());

-- Mini double-entry ledger table printed on the voucher (รหัสบัญชี/CODE,
-- รายการ/DESCRIPTIONS, DEBIT, CREDIT) — a child table since a real voucher
-- can post to any number of GL accounts. Visibility/write rules mirror the
-- parent voucher exactly (same reasoning as project_items following projects).
create table payment_voucher_ledger_lines (
  id uuid primary key default gen_random_uuid(),
  voucher_id uuid not null references payment_vouchers(id) on delete cascade,
  account_code text,
  description text,
  debit numeric(14,2) not null default 0,
  credit numeric(14,2) not null default 0,
  sort_order int not null default 0
);

alter table payment_voucher_ledger_lines enable row level security;

create policy payment_voucher_ledger_lines_select on payment_voucher_ledger_lines for select
  using (exists (select 1 from payment_vouchers v where v.id = voucher_id and my_role() <> 'sales'));
create policy payment_voucher_ledger_lines_write on payment_voucher_ledger_lines for all
  using (exists (
    select 1 from payment_vouchers v
    where v.id = voucher_id
      and (my_role() in ('owner', 'manager', 'account') or v.recorded_by = auth.uid())
  ))
  with check (exists (
    select 1 from payment_vouchers v
    where v.id = voucher_id
      and (my_role() in ('owner', 'manager', 'account') or v.recorded_by = auth.uid())
  ));

-- ---------- เงินสดย่อย (Petty Cash) ----------
-- Append-only ledger with a running balance — deliberately no edit/delete
-- policy. A running-balance chain can't be edited or deleted in the middle
-- without recomputing every later balance (a real class of complexity this
-- sidesteps entirely); a mistake gets corrected the way real bookkeeping
-- does it, with an offsetting entry, not by rewriting history. Same
-- append-only shape as login_log/activity_log/sales_lead_change_log.
create table petty_cash_transactions (
  id uuid primary key default gen_random_uuid(),
  doc_no text not null unique,
  transaction_date date not null default current_date,
  transaction_type text not null check (transaction_type in ('topup', 'expense')),
  amount numeric(14,2) not null,
  description text not null,
  balance_after numeric(14,2) not null,
  recorded_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  category text,
  biller_name text,
  job_no text,
  vat_amount numeric(14,2) not null default 0,
  wht_amount numeric(14,2) not null default 0
);

alter table petty_cash_transactions enable row level security;

create policy petty_cash_select on petty_cash_transactions for select
  using (my_role() <> 'sales');
create policy petty_cash_insert on petty_cash_transactions for insert
  with check (my_role() in ('owner', 'manager', 'account'));
-- Originally append-only (no update/delete policy) — the user later asked
-- for full edit/delete, added in migration_033 along with
-- recompute_petty_cash_balances() so balance_after never goes stale.
create policy petty_cash_update on petty_cash_transactions for update
  using (my_role() in ('owner', 'manager', 'account'))
  with check (my_role() in ('owner', 'manager', 'account'));
create policy petty_cash_delete on petty_cash_transactions for delete
  using (my_role() in ('owner', 'manager', 'account'));

-- Only writer of balance_after — computes it atomically from the last
-- transaction so two near-simultaneous entries can never both read the
-- same stale balance (the same concurrency reasoning as record_stock_movement).
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

-- Recomputes the whole ledger's running balance in chronological order —
-- called by update/delete below so editing or removing any row (not just
-- the latest) never leaves a later row's balance_after stale.
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

-- เงินเดือน (payroll): an employees master list + one entry per employee
-- per month, matching the company's existing paper "ใบจ่ายเงินเดือน/ค่าแรง"
-- slip layout. Admin-only (owner/manager) throughout — individual salary
-- data is far more sensitive than the rest of Expenses, which also allows
-- the account role.
create table employees (
  id uuid primary key default gen_random_uuid(),
  employee_code text not null unique,
  full_name text not null,
  position text,
  id_card_no text,
  start_date date,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table employees enable row level security;

create policy employees_select on employees for select
  using (my_role() in ('owner', 'manager'));
create policy employees_write on employees for all
  using (my_role() in ('owner', 'manager')) with check (my_role() in ('owner', 'manager'));

create table payroll_entries (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  -- Always the 1st of the paid-for month (e.g. 2026-01-01) — display uses
  -- the month/year, the day is just a fixed anchor for date math/sorting.
  pay_period date not null,
  pay_date date,
  base_salary numeric(14,2) not null default 0,
  fuel_allowance numeric(14,2) not null default 0,
  commission numeric(14,2) not null default 0,
  incentive numeric(14,2) not null default 0,
  social_security numeric(14,2) not null default 0,
  withholding_tax numeric(14,2) not null default 0,
  other_deductions numeric(14,2) not null default 0,
  total_income numeric(14,2) generated always as (base_salary + fuel_allowance + commission + incentive) stored,
  total_deductions numeric(14,2) generated always as (social_security + withholding_tax + other_deductions) stored,
  net_salary numeric(14,2) generated always as (
    base_salary + fuel_allowance + commission + incentive - social_security - withholding_tax - other_deductions
  ) stored,
  note text,
  prepared_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  unique (employee_id, pay_period)
);
alter table payroll_entries enable row level security;

create policy payroll_entries_select on payroll_entries for select
  using (my_role() in ('owner', 'manager'));
create policy payroll_entries_write on payroll_entries for all
  using (my_role() in ('owner', 'manager')) with check (my_role() in ('owner', 'manager'));

-- คำนวณค่าคอมมิชชั่น: a rate-tier lookup table (discount % given to the
-- customer -> commission % paid to the broker/sales rep who closed the
-- deal) plus one row per commissionable sale. Same admin+account tier as
-- the rest of Expenses (unlike เงินเดือน, which is admin-only) since
-- commission payouts are operational, not individual-salary-sensitive.
create table commission_rate_tiers (
  id uuid primary key default gen_random_uuid(),
  discount_percent numeric(5,2) not null unique,
  commission_rate_percent numeric(5,2) not null,
  created_at timestamptz not null default now()
);
alter table commission_rate_tiers enable row level security;

create policy commission_rate_tiers_select on commission_rate_tiers for select
  using (my_role() in ('owner', 'manager', 'account'));
create policy commission_rate_tiers_write on commission_rate_tiers for all
  using (my_role() in ('owner', 'manager')) with check (my_role() in ('owner', 'manager'));

insert into commission_rate_tiers (discount_percent, commission_rate_percent) values
  (0, 4.50), (5, 4.25), (10, 4.00), (15, 3.00), (20, 2.50), (25, 2.00), (30, 1.50), (40, 1.00);

-- One commission row per fully-collected Project Sales job ("เอาเฉพาะ
-- Project ที่เก็บเงินเรียบร้อยแล้ว") — everything else (job_no, customer,
-- sales rep, amount, invoice/receipt no, received date) is read live from
-- projects/payments; the only real input here is discount_percent.
create table commission_entries (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null unique references projects(id) on delete cascade,
  discount_percent numeric(5,2) not null default 0,
  -- Looked up from commission_rate_tiers when discount_percent is saved
  -- (editable/overridable) rather than joined live, so a later change to
  -- the rate table never silently rewrites a job's already-paid commission.
  commission_rate_percent numeric(5,2) not null default 0,
  commission_amount numeric(14,2) not null default 0,
  note text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
alter table commission_entries enable row level security;

create policy commission_entries_select on commission_entries for select
  using (my_role() in ('owner', 'manager', 'account'));
create policy commission_entries_write on commission_entries for all
  using (my_role() in ('owner', 'manager')) with check (my_role() in ('owner', 'manager'));

-- ============ ใบเสนอราคา (Quotations) ============

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
  product_name text not null default '',
  thickness text,
  size text,
  color text,
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

-- ============ ใบวางบิล / ใบกำกับภาษี / ใบเสร็จรับเงิน (Billing Documents) ============
-- 3 separate sidebar menus, one shared schema distinguished by doc_type.
-- Each document bundles a customer's already-invoiced WALLPOD Project Sales
-- payment installments (snapshotted into billing_note_items) with
-- document-level discount/WHT%/retention% deductions.

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
