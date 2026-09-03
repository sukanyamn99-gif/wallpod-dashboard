-- Adds contact-detail columns to customers so a quotation's Attn/address/
-- phone/tax ID can be saved against the customer record and reused
-- (auto-filled) the next time that customer's name is picked. All nullable
-- — existing rows simply have no contact details yet, an honest gap rather
-- than a fabricated backfill.

alter table customers
  add column contact_person text,
  add column address text,
  add column phone text,
  add column tax_id text;
