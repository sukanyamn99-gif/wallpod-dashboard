-- Lets ผู้จำหน่าย be split into ในประเทศ/ต่างประเทศ on the management page.
-- Existing rows default to ในประเทศ — many are actually foreign (Chinese
-- manufacturers, judging by their names/addresses), but that's a real data
-- call best left to a human to fix per-row via the new field, not guessed
-- from text patterns here.
alter table suppliers
  add column supplier_type text not null default 'ในประเทศ'
    check (supplier_type in ('ในประเทศ', 'ต่างประเทศ'));
