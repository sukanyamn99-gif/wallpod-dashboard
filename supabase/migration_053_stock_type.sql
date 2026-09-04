alter table stock_products
  add column stock_type text not null default 'finished_good'
    check (stock_type in ('raw_material', 'finished_good'));
