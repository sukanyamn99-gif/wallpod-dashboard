-- Lets a billing document remember which JOB it was created for — needed
-- to print "เลขที่ Job" on the document, since a manually-typed line item
-- (no quotation_id/payment_id) has no other way to derive it. Set once at
-- creation from whatever JOB the JobNoSelect picker had selected; older
-- documents predating this column stay null (see getBillingDocumentById's
-- fallback derivation for those).
alter table billing_notes add column job_no text;
