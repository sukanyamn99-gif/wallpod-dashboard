-- Lets a quotation be marked as a goods quote (ค่าของ) or an installation
-- quote (ค่าติดตั้ง) — the print view uses this to swap the standard remark
-- text and to show the extra wall/ceiling-preparation conditions block that
-- only applies to installation work.
alter table quotations
  add column quotation_type text not null default 'ค่าของ'
    check (quotation_type in ('ค่าของ', 'ค่าติดตั้ง'));
