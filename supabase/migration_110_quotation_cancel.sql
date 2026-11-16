-- ยกเลิก a quotation instead of deleting it: the row stays on the list, marked
-- cancelled, and stops counting — in the month totals, the production orders
-- and the quotation pickers on billing documents. Reversible.
alter table quotations
  add column if not exists is_cancelled boolean not null default false,
  add column if not exists cancelled_at timestamptz;
