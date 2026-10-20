-- Satang rounding ("ปัดเศษ") on a billing document that deducts a deposit —
-- stored per document, decided when it is saved, so documents issued before
-- this existed keep their exact amounts (default 0) instead of changing
-- retroactively when they're next opened or printed.
alter table billing_notes
  add column if not exists rounding_amount numeric(14,2) not null default 0;
