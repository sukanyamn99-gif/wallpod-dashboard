-- Reverts migration_053: the user decided against tagging existing stock
-- products with a raw-material/finished-good type, in favor of a fully
-- separate Finished Goods system (own tables, own menu) instead.
alter table stock_products drop column if exists stock_type;
