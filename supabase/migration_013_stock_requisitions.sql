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

create policy stock_requisitions_select on stock_requisitions for select using (auth.uid() is not null);
create policy stock_requisitions_insert on stock_requisitions for insert
  with check (my_role() in ('owner','manager','production'));
create policy stock_requisitions_delete on stock_requisitions for delete
  using (my_role() in ('owner','manager') or requested_by = auth.uid());

create policy stock_requisition_items_select on stock_requisition_items for select using (auth.uid() is not null);
create policy stock_requisition_items_insert on stock_requisition_items for insert
  with check (my_role() in ('owner','manager','production'));
