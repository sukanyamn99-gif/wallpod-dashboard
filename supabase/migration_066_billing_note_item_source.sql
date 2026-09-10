-- Lets a ใบเสร็จรับเงิน be issued directly from a manually-typed ใบวางบิล
-- line item (no quotation_id/payment_id to browse by, unlike the existing
-- tax-invoice/invoice pickers) by copying that line onto the receipt as its
-- own manual item, tagged with where it came from so the same ใบวางบิล line
-- isn't offered again once it's actually been receipted.
alter table billing_note_items
  add column source_item_id uuid references billing_note_items(id) on delete set null;
