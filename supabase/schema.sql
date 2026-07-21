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
  product_category text not null check (product_category in
    ('WALLPOD','ACOUSHEET','ACOUSOFT','ACUBOX','CNC','SERVICE','WALLPAPER','OTHER')),
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
create policy projects_select on projects for select
  using (my_role() in ('owner','manager') or sales_rep_id = my_sales_rep_id());
create policy projects_write on projects for all
  using (my_role() in ('owner','manager') or sales_rep_id = my_sales_rep_id())
  with check (my_role() in ('owner','manager') or sales_rep_id = my_sales_rep_id());

-- child tables inherit visibility from their parent project
create policy project_items_select on project_items for select
  using (exists (select 1 from projects p where p.id = project_id
    and (my_role() in ('owner','manager') or p.sales_rep_id = my_sales_rep_id())));
create policy project_items_write on project_items for all
  using (exists (select 1 from projects p where p.id = project_id
    and (my_role() in ('owner','manager') or p.sales_rep_id = my_sales_rep_id())));

create policy project_costs_select on project_costs for select
  using (my_role() in ('owner','manager'));
create policy project_costs_write on project_costs for all
  using (my_role() in ('owner','manager'));

create policy payments_select on payments for select
  using (exists (select 1 from projects p where p.id = project_id
    and (my_role() in ('owner','manager') or p.sales_rep_id = my_sales_rep_id())));
create policy payments_write on payments for all
  using (my_role() in ('owner','manager','account'));

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
