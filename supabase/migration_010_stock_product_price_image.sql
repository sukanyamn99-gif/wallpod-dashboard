alter table stock_products
  add column selling_price numeric(14,2),
  add column image_path text;

-- ============ Stock Product photo (private Storage bucket) ============
-- Mirrors stock_products table RLS exactly (role-based, not folder-owned —
-- stock products have no owning sales rep, unlike sale-report-images).

insert into storage.buckets (id, name, public)
values ('stock-product-images', 'stock-product-images', false)
on conflict (id) do nothing;

create policy stock_product_images_select on storage.objects
  for select using (
    bucket_id = 'stock-product-images'
    and auth.uid() is not null
  );

create policy stock_product_images_insert on storage.objects
  for insert with check (
    bucket_id = 'stock-product-images'
    and my_role() in ('owner','manager')
  );

create policy stock_product_images_delete on storage.objects
  for delete using (
    bucket_id = 'stock-product-images'
    and my_role() in ('owner','manager')
  );
