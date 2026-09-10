-- Precise correlator for quotation-sourced installments: the SPECIFIC tax
-- invoice that owns an installment, not just its quotation. Needed to
-- support billing a quotation in multiple partial tax invoices (each its
-- own installment) — matching on quotation_id alone (migration_063) can't
-- tell two partial tax invoices against the same quotation apart. A later
-- ใบวางบิล/ใบเสร็จรับเงิน that selects one of those tax invoices correlates
-- via this same id, so it updates that SAME installment.
alter table payments add column source_tax_invoice_id uuid references billing_notes(id) on delete set null;
