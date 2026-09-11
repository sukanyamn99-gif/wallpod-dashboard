-- ใบหัก ณ ที่จ่าย (Withholding Tax Certificate, มาตรา 50 ทวิ) needs the payee's
-- tax id/address (the official form has a dedicated 13-digit box for each
-- party) and which of the 6 standardized income-type categories applies —
-- none of which payment_vouchers tracked before, since the voucher itself
-- only needed the payer's (this company's) side.
alter table payment_vouchers
  add column payee_tax_id text,
  add column payee_address text,
  add column income_type text not null default '5'
    check (income_type in ('1', '2', '3', '4a', '4b', '5', '6'));
