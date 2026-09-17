-- เอกสารข้อมูล — a catalog/document library staff can browse and download
-- (product catalogs, spec sheets, etc.). Any authenticated user can view/
-- download; only owner/manager/support_sale can upload or remove entries.
create table data_documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null default 'เอกสาร',
  file_path text not null,
  file_type text not null,
  file_size_bytes bigint not null,
  thumbnail_path text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

alter table data_documents enable row level security;
create policy data_documents_select on data_documents for select using (auth.uid() is not null);
create policy data_documents_write on data_documents for all
  using (my_role() in ('owner','manager','support_sale'))
  with check (my_role() in ('owner','manager','support_sale'));

insert into storage.buckets (id, name, public)
values ('data-documents', 'data-documents', false)
on conflict (id) do nothing;

create policy data_documents_files_select on storage.objects for select using (
  bucket_id = 'data-documents' and auth.uid() is not null
);
create policy data_documents_files_insert on storage.objects for insert with check (
  bucket_id = 'data-documents' and my_role() in ('owner','manager','support_sale')
);
create policy data_documents_files_delete on storage.objects for delete using (
  bucket_id = 'data-documents' and my_role() in ('owner','manager','support_sale')
);
