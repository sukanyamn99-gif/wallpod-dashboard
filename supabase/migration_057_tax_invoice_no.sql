-- Lets a payments installment also record which ใบกำกับภาษี (tax invoice)
-- it was billed under, mirroring the existing billing_note_no/receipt_no
-- columns/pattern. Combined with the billing-documents sync-back in
-- src/app/dashboard/billing-documents/actions.ts, issuing a ใบกำกับภาษี/
-- ใบวางบิล/ใบเสร็จรับเงิน now writes its doc no. straight onto the matching
-- JOB's own Koonway Project Sales record automatically.
alter table payments add column tax_invoice_no text, add column tax_invoice_date date;
