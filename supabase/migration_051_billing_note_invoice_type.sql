alter table billing_notes drop constraint if exists billing_notes_doc_type_check;
alter table billing_notes add constraint billing_notes_doc_type_check
  check (doc_type in ('billing_note', 'tax_invoice', 'receipt', 'invoice'));
