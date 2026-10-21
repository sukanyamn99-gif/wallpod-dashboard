-- A payment voucher records what was PAID (VAT included, when the vendor
-- charged VAT). Job cost should count the pre-VAT amount, so each voucher
-- carries a flag: when set, its per-JOB allocations are divided by 1.07
-- wherever job cost is reported. Existing vouchers default to false, i.e.
-- their job cost is unchanged until someone ticks the box.
alter table payment_vouchers
  add column if not exists vat_included boolean not null default false;

-- The AI read-only profit view must follow the same rule (same columns as
-- migration_095, only the "pv" source changes).
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
  select trim(a.job_no) as job_no,
         sum(case when v.vat_included then round(a.amount / 1.07, 2) else a.amount end) as amount
  from payment_voucher_job_allocations a
  join payment_vouchers v on v.id = a.voucher_id
  group by trim(a.job_no)
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
