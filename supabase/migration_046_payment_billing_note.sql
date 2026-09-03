-- Adds a "ใบวางบิล" (billing note) number + date to each payment
-- installment, alongside the existing invoice_no/paid_date (document
-- issue) and receipt_no/received_date (money received) pair — the
-- billing note is a third, earlier document in the same Thai
-- billing-to-collection sequence (ใบวางบิล -> ใบแจ้งหนี้/invoice ->
-- ใบเสร็จ/receipt).

alter table payments
  add column billing_note_no text,
  add column billing_note_date date;
