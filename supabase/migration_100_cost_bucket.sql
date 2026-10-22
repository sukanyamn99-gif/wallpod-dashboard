-- Which Project Sales cost column a document's cost lands in (see
-- src/lib/job-cost-buckets.ts):
--   * a requisition line is ค่าวัสดุ or ค่ากาว — set per line, so one
--     requisition can carry both
--   * a payment voucher / petty-cash expense picks one of ค่าวัสดุ, ค่าตัด,
--     ค่าติดตั้งผู้รับเหมา, ค่าขนส่ง, ค่าเดินทาง+ค่าที่จอดรถ, อื่นๆ. NULL on
--     rows saved before this existed — they keep being sorted by the
--     keyword match on their free-text category.
alter table stock_requisition_items
  add column if not exists cost_bucket text not null default 'material'
    check (cost_bucket in ('material', 'glue'));

alter table payment_vouchers
  add column if not exists cost_bucket text
    check (cost_bucket in ('material', 'cutting', 'install', 'shipping', 'parking', 'other'));

alter table petty_cash_transactions
  add column if not exists cost_bucket text
    check (cost_bucket in ('material', 'cutting', 'install', 'shipping', 'parking', 'other'));
