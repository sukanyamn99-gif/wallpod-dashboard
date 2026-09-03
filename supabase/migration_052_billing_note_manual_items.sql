alter table billing_note_items
  add column manual_description text,
  add column manual_qty numeric(14,2),
  add column manual_unit text,
  add column manual_unit_price numeric(14,2);
