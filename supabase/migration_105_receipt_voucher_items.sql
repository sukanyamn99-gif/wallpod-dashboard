-- The ใบสำคัญรับเงิน form is a plain รายการ / จำนวนเงิน (บาท, ส.ต.) list, not an
-- accounting journal — so the debit/credit lines of migration_104 become simple
-- items. Any voucher already issued keeps its amount as a single item (its
-- description, or "รับชำระเงิน" when it had none).

create table receipt_voucher_items (
  id uuid primary key default gen_random_uuid(),
  voucher_id uuid not null references receipt_vouchers(id) on delete cascade,
  description text not null default '',
  amount numeric(14,2) not null default 0,
  sort_order int not null default 0
);

create index receipt_voucher_items_voucher_idx on receipt_voucher_items (voucher_id);

alter table receipt_voucher_items enable row level security;

create policy receipt_voucher_items_select on receipt_voucher_items for select
  using (my_role() <> 'sales');
create policy receipt_voucher_items_write on receipt_voucher_items for all
  using (my_role() in ('owner', 'manager', 'account', 'support_sale'))
  with check (my_role() in ('owner', 'manager', 'account', 'support_sale'));

insert into receipt_voucher_items (voucher_id, description, amount, sort_order)
select v.id, coalesce(nullif(trim(v.description), ''), 'รับชำระเงิน'), coalesce(sum(l.debit), 0), 0
from receipt_vouchers v
left join receipt_voucher_lines l on l.voucher_id = v.id
group by v.id, v.description;

drop table receipt_voucher_lines;
alter table receipt_vouchers drop column description;
