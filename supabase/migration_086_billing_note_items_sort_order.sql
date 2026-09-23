-- Lets staff control the printed line order on ใบแจ้งหนี้/ใบกำกับภาษี/
-- ใบวางบิล/ใบเสร็จรับเงิน — without this, items always print in whatever
-- order Postgres happens to return them (effectively insert order, driven
-- by checkbox click order, which staff has no real control over). Default
-- 0 for every existing row means every one of them ties — Postgres then
-- falls back to its own row order for those (in practice still insertion
-- order), an honest "no explicit order set yet" rather than 0 meaning
-- anything semantically.
alter table billing_note_items
  add column sort_order integer not null default 0;
