alter table sales_leads add column phone text;
alter table sales_leads add column image_paths text[] not null default '{}';

insert into storage.buckets (id, name, public)
values ('sale-report-images', 'sale-report-images', false)
on conflict (id) do nothing;

create policy sale_report_images_select on storage.objects
  for select using (
    bucket_id = 'sale-report-images'
    and (my_role() in ('owner','manager')
         or (storage.foldername(name))[1]::uuid = my_sales_rep_id())
  );

create policy sale_report_images_insert on storage.objects
  for insert with check (
    bucket_id = 'sale-report-images'
    and (my_role() in ('owner','manager')
         or (storage.foldername(name))[1]::uuid = my_sales_rep_id())
  );

create policy sale_report_images_delete on storage.objects
  for delete using (
    bucket_id = 'sale-report-images'
    and (my_role() in ('owner','manager')
         or (storage.foldername(name))[1]::uuid = my_sales_rep_id())
  );
