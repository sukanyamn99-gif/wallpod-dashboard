-- Auto-running product code for finished_goods (e.g. KW0001, KW0002, ...),
-- generated server-side on create (see generateFinishedGoodSku in
-- src/app/dashboard/finished-goods/actions.ts) — never user-typed, unlike
-- stock_products.sku which stays manual. Safe as `not null unique` with no
-- default since the table currently has 0 rows.
alter table finished_goods add column sku text not null unique;
