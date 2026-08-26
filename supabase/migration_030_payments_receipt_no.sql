-- Adds a receipt-number field per installment on Project Sales payments.
-- An invoice number alone doesn't mean money has actually arrived — a job
-- can be invoiced (INV issued) well before the bank transfer clears. The
-- app now treats an installment as "actually paid" only once its receipt
-- number is filled in; the invoice number/amount alone no longer counts
-- toward reducing ยอดคงค้าง (outstanding).
alter table payments add column receipt_no text;
