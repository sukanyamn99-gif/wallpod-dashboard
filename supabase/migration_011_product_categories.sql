create table product_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

alter table product_categories enable row level security;

create policy product_categories_select on product_categories for select using (auth.uid() is not null);
create policy product_categories_write on product_categories for all
  using (my_role() in ('owner','manager')) with check (my_role() in ('owner','manager'));

insert into product_categories (name) values
  ('WALLPOD'),('ACOUSHEET'),('ACOUSOFT'),('ACUBOX'),('CNC'),('SERVICE'),('WALLPAPER'),('OTHER')
on conflict (name) do nothing;

-- The category list is now managed via product_categories instead of a
-- hardcoded set, so the old fixed-value constraints no longer apply.
-- Existing project_items/stock_products rows keep their text values as-is.
alter table project_items drop constraint if exists project_items_product_category_check;
alter table stock_products drop constraint if exists stock_products_category_check;
