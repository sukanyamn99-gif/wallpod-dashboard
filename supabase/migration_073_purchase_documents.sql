-- เอกสารซื้อ: ใบขอซื้อ (PR) → ใบสั่งซื้อ (PO) → ใบรับสินค้า (linked receiving,
-- separate from the existing ad-hoc goods_receipts/"รับเข้าสินค้า" feature).
-- Mirrors the header+snapshot-items shape already proven for
-- stock_requisitions/goods_receipts, reusing the existing departments and
-- suppliers reference tables rather than creating parallel ones.

create table purchase_requests (
  id uuid primary key default gen_random_uuid(),
  doc_no text not null unique,
  request_date date not null default current_date,
  requested_by uuid references profiles(id),
  department_id uuid references departments(id),
  purpose text,
  status text not null default 'รออนุมัติ' check (status in ('รออนุมัติ', 'อนุมัติ', 'ไม่อนุมัติ')),
  approved_by uuid references profiles(id),
  approved_at timestamptz,
  note text,
  created_at timestamptz not null default now()
);

create table purchase_request_items (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references purchase_requests(id) on delete cascade,
  stock_product_id uuid references stock_products(id) on delete set null,
  product_name_snapshot text not null,
  product_sku_snapshot text,
  unit_snapshot text not null default 'ชิ้น',
  quantity numeric(14,2) not null,
  note text
);

alter table purchase_requests enable row level security;
alter table purchase_request_items enable row level security;

create policy purchase_requests_select on purchase_requests for select using (my_role() <> 'sales');
create policy purchase_requests_insert on purchase_requests for insert
  with check (my_role() in ('owner', 'manager', 'production', 'support_sale', 'account'));
-- Approve/reject is an update, deliberately narrower than insert — only
-- owner/manager decide whether a request proceeds to become a PO.
create policy purchase_requests_update on purchase_requests for update
  using (my_role() in ('owner', 'manager'))
  with check (my_role() in ('owner', 'manager'));
create policy purchase_requests_delete on purchase_requests for delete
  using (my_role() in ('owner', 'manager') or requested_by = auth.uid());

create policy purchase_request_items_select on purchase_request_items for select using (my_role() <> 'sales');
create policy purchase_request_items_insert on purchase_request_items for insert
  with check (my_role() in ('owner', 'manager', 'production', 'support_sale', 'account'));

create table purchase_orders (
  id uuid primary key default gen_random_uuid(),
  doc_no text not null unique,
  request_id uuid not null references purchase_requests(id),
  supplier_id uuid references suppliers(id),
  order_date date not null default current_date,
  ordered_by uuid references profiles(id),
  expected_date date,
  note text,
  created_at timestamptz not null default now()
);

create table purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references purchase_orders(id) on delete cascade,
  stock_product_id uuid references stock_products(id) on delete set null,
  product_name_snapshot text not null,
  product_sku_snapshot text,
  unit_snapshot text not null default 'ชิ้น',
  quantity numeric(14,2) not null,
  unit_price numeric(14,2) not null default 0
);

alter table purchase_orders enable row level security;
alter table purchase_order_items enable row level security;

create policy purchase_orders_select on purchase_orders for select using (my_role() <> 'sales');
create policy purchase_orders_insert on purchase_orders for insert
  with check (my_role() in ('owner', 'manager', 'production', 'support_sale', 'account'));
create policy purchase_orders_delete on purchase_orders for delete
  using (my_role() in ('owner', 'manager') or ordered_by = auth.uid());

create policy purchase_order_items_select on purchase_order_items for select using (my_role() <> 'sales');
create policy purchase_order_items_insert on purchase_order_items for insert
  with check (my_role() in ('owner', 'manager', 'production', 'support_sale', 'account'));

-- ใบรับสินค้า tied specifically to a purchase order (tracks received vs.
-- ordered quantity per line) — a new, separate document from the existing
-- goods_receipts/"รับเข้าสินค้า" ad-hoc restocking feature. Reuses the
-- existing record_goods_receipt RPC per item so the same proven
-- weighted-average costing logic applies, rather than duplicating it.
create table purchase_order_receipts (
  id uuid primary key default gen_random_uuid(),
  doc_no text not null unique,
  order_id uuid not null references purchase_orders(id),
  receipt_date date not null default current_date,
  received_by uuid references profiles(id),
  note text,
  created_at timestamptz not null default now()
);

create table purchase_order_receipt_items (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references purchase_order_receipts(id) on delete cascade,
  order_item_id uuid references purchase_order_items(id) on delete set null,
  stock_product_id uuid references stock_products(id) on delete set null,
  product_name_snapshot text not null,
  product_sku_snapshot text,
  unit_snapshot text not null default 'ชิ้น',
  quantity numeric(14,2) not null,
  unit_cost numeric(14,2) not null default 0
);

alter table purchase_order_receipts enable row level security;
alter table purchase_order_receipt_items enable row level security;

create policy purchase_order_receipts_select on purchase_order_receipts for select using (my_role() <> 'sales');
create policy purchase_order_receipts_insert on purchase_order_receipts for insert
  with check (my_role() in ('owner', 'manager', 'production', 'support_sale', 'account'));
create policy purchase_order_receipts_delete on purchase_order_receipts for delete
  using (my_role() in ('owner', 'manager') or received_by = auth.uid());

create policy purchase_order_receipt_items_select on purchase_order_receipt_items for select using (my_role() <> 'sales');
create policy purchase_order_receipt_items_insert on purchase_order_receipt_items for insert
  with check (my_role() in ('owner', 'manager', 'production', 'support_sale', 'account'));
