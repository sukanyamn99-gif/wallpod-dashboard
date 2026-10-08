-- One payment voucher can now be split across several JOBs, each with its own
-- share of the voucher's amount. The voucher's total (amount, WHT, what is
-- actually paid) is unchanged — only the job-cost attribution is split.
-- Job cost reports sum THIS table instead of payment_vouchers.job_no;
-- payment_vouchers.job_no stays as the first/primary job for display.

create table payment_voucher_job_allocations (
  id uuid primary key default gen_random_uuid(),
  voucher_id uuid not null references payment_vouchers(id) on delete cascade,
  job_no text not null,
  amount numeric(14,2) not null check (amount > 0),
  sort_order int not null default 0
);

create index payment_voucher_job_allocations_voucher_idx on payment_voucher_job_allocations (voucher_id);
create index payment_voucher_job_allocations_job_idx on payment_voucher_job_allocations (job_no);

alter table payment_voucher_job_allocations enable row level security;

-- Visibility/write rules mirror the parent voucher exactly (same pattern as
-- payment_voucher_ledger_lines).
create policy payment_voucher_job_allocations_select on payment_voucher_job_allocations for select
  using (exists (select 1 from payment_vouchers v where v.id = voucher_id and my_role() <> 'sales'));
create policy payment_voucher_job_allocations_write on payment_voucher_job_allocations for all
  using (exists (
    select 1 from payment_vouchers v
    where v.id = voucher_id
      and (my_role() in ('owner', 'manager', 'account') or v.recorded_by = auth.uid())
  ))
  with check (exists (
    select 1 from payment_vouchers v
    where v.id = voucher_id
      and (my_role() in ('owner', 'manager', 'account') or v.recorded_by = auth.uid())
  ));

-- Every existing voucher that was tied to a JOB becomes a single allocation
-- for its full amount, so job cost totals stay exactly what they were.
insert into payment_voucher_job_allocations (voucher_id, job_no, amount)
select id, trim(job_no), amount
from payment_vouchers
where nullif(trim(job_no), '') is not null and amount > 0;

-- The AI read-only profit view (see migration_093) attributed voucher cost by
-- payment_vouchers.job_no; it must follow the allocations now. Same columns
-- as before, only the "pv" source changes.
create or replace view ai.gp as
with req as (
  select trim(r.job_no) as job_no,
         sum(i.quantity * case when i.unit_cost > 0 then i.unit_cost else coalesce(sp.unit_cost, 0) end) as amount
  from stock_requisition_items i
  join stock_requisitions r on r.id = i.requisition_id
  left join stock_products sp on sp.id = i.stock_product_id
  where nullif(trim(r.job_no), '') is not null
  group by trim(r.job_no)
),
pv as (
  select trim(job_no) as job_no, sum(amount) as amount
  from payment_voucher_job_allocations
  group by trim(job_no)
),
pc as (
  select trim(job_no) as job_no, sum(amount) as amount
  from petty_cash_transactions
  where transaction_type = 'expense' and nullif(trim(job_no), '') is not null
  group by trim(job_no)
)
select
  x.*,
  x.pre_vat - x.total_cost as profit,
  case when x.pre_vat > 0 then round((x.pre_vat - x.total_cost) / x.pre_vat * 100, 1) end as margin_percent
from (
  select
    p.job_no,
    p.project_date,
    to_char(p.project_date, 'YYYY-MM') as month,
    c.name as customer_name,
    p.customer_type,
    sr.name as sales_rep,
    p.project_name,
    p.pre_vat,
    coalesce(pcst.material_cost, 0) as material_cost,
    coalesce(pcst.glue_cost, 0) as glue_cost,
    coalesce(pcst.cutting_cost, 0) as cutting_cost,
    coalesce(pcst.install_cost, 0) as install_cost,
    coalesce(pcst.parking_cost, 0) as parking_cost,
    coalesce(pcst.shipping_cost, 0) as shipping_cost,
    coalesce(pcst.total_cost, 0) as manual_cost_total,
    coalesce(req.amount, 0) as requisition_cost,
    coalesce(pv.amount, 0) as voucher_cost,
    coalesce(pc.amount, 0) as petty_cash_cost,
    coalesce(pcst.total_cost, 0) + coalesce(req.amount, 0) + coalesce(pv.amount, 0) + coalesce(pc.amount, 0) as total_cost
  from projects p
  join customers c on c.id = p.customer_id
  join sales_reps sr on sr.id = p.sales_rep_id
  left join project_costs pcst on pcst.project_id = p.id
  left join req on req.job_no = trim(p.job_no)
  left join pv on pv.job_no = trim(p.job_no)
  left join pc on pc.job_no = trim(p.job_no)
  where not p.is_cancelled
    and (pcst.id is not null
         or coalesce(req.amount, 0) + coalesce(pv.amount, 0) + coalesce(pc.amount, 0) > 0)
) x;
