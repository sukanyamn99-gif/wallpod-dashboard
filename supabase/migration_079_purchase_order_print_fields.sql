-- Fields needed to print a formal ใบสั่งซื้อ (PO) document: credit terms
-- (due date is computed on read as order_date + credit_days, not stored),
-- plus an optional document-level discount and withholding-tax rate —
-- mirrors the same discount/WHT pattern already used on billing_notes.
alter table purchase_orders
  add column credit_days integer not null default 30,
  add column discount_amount numeric(14,2) not null default 0,
  add column wht_percent numeric(5,2) not null default 0;
