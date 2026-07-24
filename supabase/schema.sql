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
  created_at timestamptz not null default now()
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
  outstanding_amount numeric(14,2) not null default 0
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

-- sales_reps / customers: all logged-in staff can read (needed for dropdowns/labels)
create policy sales_reps_select on sales_reps for select using (auth.uid() is not null);
create policy customers_select on customers for select using (auth.uid() is not null);
create policy sales_reps_write on sales_reps for all
  using (my_role() in ('owner','manager')) with check (my_role() in ('owner','manager'));
create policy customers_write on customers for all
  using (my_role() in ('owner','manager','support_sale')) with check (my_role() in ('owner','manager','support_sale'));

-- projects: owner/manager see everything; sales see only their own
create policy projects_select on projects for select using (my_role() <> 'sales');
create policy projects_write on projects for all
  using (my_role() <> 'sales') with check (my_role() <> 'sales');

-- child tables inherit visibility from their parent project
create policy project_items_select on project_items for select
  using (exists (select 1 from projects p where p.id = project_id and my_role() <> 'sales'));
create policy project_items_write on project_items for all
  using (exists (select 1 from projects p where p.id = project_id and my_role() <> 'sales'));

create policy project_costs_select on project_costs for select
  using (my_role() in ('owner','manager'));
create policy project_costs_write on project_costs for all
  using (my_role() in ('owner','manager'));

create policy payments_select on payments for select
  using (exists (select 1 from projects p where p.id = project_id and my_role() <> 'sales'));
create policy payments_write on payments for all using (my_role() <> 'sales');

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
create policy stock_products_write on stock_products for all
  using (my_role() in ('owner','manager')) with check (my_role() in ('owner','manager'));

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
create policy product_categories_write on product_categories for all
  using (my_role() in ('owner','manager')) with check (my_role() in ('owner','manager'));

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
  quantity numeric(14,2) not null
);

alter table stock_requisitions enable row level security;
alter table stock_requisition_items enable row level security;

create policy stock_requisitions_select on stock_requisitions for select using (my_role() <> 'sales');
create policy stock_requisitions_insert on stock_requisitions for insert
  with check (my_role() in ('owner','manager','production'));
create policy stock_requisitions_delete on stock_requisitions for delete
  using (my_role() in ('owner','manager') or requested_by = auth.uid());

create policy stock_requisition_items_select on stock_requisition_items for select using (my_role() <> 'sales');
create policy stock_requisition_items_insert on stock_requisition_items for insert
  with check (my_role() in ('owner','manager','production'));

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
