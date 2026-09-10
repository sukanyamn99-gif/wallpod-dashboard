-- Captured when issuing a ใบเสร็จรับเงิน — printed in its new payment-method
-- + bank-details footer. Nullable/unchecked constraint (not required) since
-- every other doc type leaves these columns unused.
alter table billing_notes
  add column payment_method text check (payment_method in ('เงินสด', 'เช็ค', 'โอนเงิน', 'บัตรเครดิต')),
  add column bank_name text,
  add column payment_reference_no text,
  add column payment_date date;
