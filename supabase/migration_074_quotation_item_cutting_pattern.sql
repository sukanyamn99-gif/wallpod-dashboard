-- Cutting pattern/style per quotation line item ("รูปแบบการตัด") — same
-- free-text-with-autocomplete treatment already given to thickness/size/
-- color on this table, and shown alongside them on ใบลงผลิต for the
-- production/cutting team.
alter table quotation_items add column cutting_pattern text;
