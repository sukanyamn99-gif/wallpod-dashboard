-- Lets staff choose, per bundled invoice/quotation line, whether it counts
-- toward a billing document's หัก ณ ที่จ่าย (WHT) deduction — previously
-- the document-level wht_percent applied to every selected line
-- uniformly, with no way to bill several invoices together while only
-- withholding tax on some of them. Existing rows default true, preserving
-- today's "applies to everything" behavior for documents already issued.
alter table billing_note_items add column apply_wht boolean not null default true;
