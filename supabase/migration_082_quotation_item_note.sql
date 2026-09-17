-- Free-text note per quotation line item ("หมายเหตุ"), separate from the
-- document-level remark — lets a sales rep flag something specific to one
-- product row (e.g. a special install condition) without it getting lost
-- in the overall quotation's remark field.
alter table quotation_items add column note text;
