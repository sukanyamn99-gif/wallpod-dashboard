-- Split quotation_items' single free-text "description" into structured
-- fields (Product Name / Thickness / Size / Color), matching the reference
-- form's own labeled layout — and enabling per-field autocomplete from
-- previously-entered values, which a single free-text column can't support
-- without fragile regex parsing of historical rows.

alter table quotation_items drop column description;
alter table quotation_items add column product_name text not null default '';
alter table quotation_items add column thickness text;
alter table quotation_items add column size text;
alter table quotation_items add column color text;
alter table quotation_items alter column product_name drop default;
