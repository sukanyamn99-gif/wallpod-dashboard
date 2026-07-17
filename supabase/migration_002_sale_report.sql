-- Migration 002: replace "visits" (simple check-in) with "sales_leads" (Sale Report / live pipeline tracking)
-- Run this once in Supabase Studio > SQL Editor on the existing WALLPOD project.

drop table if exists visits;

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
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

alter table sales_leads enable row level security;

create policy sales_leads_select on sales_leads for select
  using (my_role() in ('owner','manager') or sales_rep_id = my_sales_rep_id());
create policy sales_leads_write on sales_leads for all
  using (my_role() in ('owner','manager') or sales_rep_id = my_sales_rep_id())
  with check (my_role() in ('owner','manager') or sales_rep_id = my_sales_rep_id());
