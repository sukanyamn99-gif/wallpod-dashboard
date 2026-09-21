-- Petty cash "จำนวนเงิน" is the cash that actually left the fund. When a bill
-- is paid AFTER withholding tax was deducted (e.g. a phone bill paid net of
-- 3% WHT), that cash amount no longer equals the VAT-inclusive bill total,
-- so the pre-VAT base (which the WHT amount and the printed ใบหัก ณ ที่จ่าย
-- both depend on) can't be derived from amount - vat_amount anymore. Store
-- it explicitly. Nullable: rows saved before this column existed fall back
-- to amount - vat_amount (exact for them, since they were all entered as
-- the VAT-inclusive total).
alter table petty_cash_transactions
  add column pre_vat_amount numeric(14,2);
