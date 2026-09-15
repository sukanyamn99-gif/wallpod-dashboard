-- Extra Discount / ส่วนลดพิเศษ — a document-level discount applied before
-- VAT, on top of each item's own ส่วนลด %. quotations.pre_vat continues to
-- store the taxable base (now net of this discount, matching how it's
-- already used when a quotation is converted into a WALLPOD Project Sales
-- job's item amount) — extra_discount_amount is the new column, and the
-- generated `total` column (pre_vat + vat) needs no change since pre_vat
-- itself is already net.
alter table quotations
  add column extra_discount_amount numeric(14,2) not null default 0;
