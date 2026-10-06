-- AI read-only access layer.
--
-- Everything the AI API may read lives in its own schema, "ai", as views that
-- expose only chosen columns. A dedicated Postgres role, ai_readonly, can
-- SELECT from those views and nothing else — no INSERT/UPDATE/DELETE, no base
-- tables. The "ai" schema is NOT in Supabase's exposed API schemas, so these
-- views are not reachable through the public REST/anon key either.
--
-- Deliberately left out of every view: customer tax IDs/phones/addresses,
-- payee tax IDs/bank accounts, user emails, free-text notes, image paths,
-- salary/social-security vouchers, payroll and commission tables.

create schema if not exists ai;
revoke all on schema ai from public, anon, authenticated;

-- ============ ai.sales — one row per job (ยอดขาย) ============

create or replace view ai.sales as
select
  p.job_no,
  p.project_date,
  to_char(p.project_date, 'YYYY-MM') as month,
  c.name as customer_name,
  p.customer_type,
  sr.name as sales_rep,
  p.project_name,
  p.pre_vat,
  p.vat,
  p.total,
  p.is_cancelled
from projects p
join customers c on c.id = p.customer_id
join sales_reps sr on sr.id = p.sales_rep_id;

comment on view ai.sales is 'ยอดขายรายงาน (1 แถวต่อ 1 JOB) — pre_vat คือยอดก่อน VAT ที่ใช้นับยอดขาย; is_cancelled = true คืองานที่ยกเลิก ควรตัดออกเมื่อสรุปยอด';
comment on column ai.sales.pre_vat is 'ยอดก่อน VAT (บาท)';
comment on column ai.sales.total is 'ยอดรวม VAT (บาท)';
comment on column ai.sales.month is 'เดือนของวันที่ขาย รูปแบบ YYYY-MM';

-- ============ ai.sales_items — job x product category ============

create or replace view ai.sales_items as
select
  p.job_no,
  p.project_date,
  to_char(p.project_date, 'YYYY-MM') as month,
  c.name as customer_name,
  sr.name as sales_rep,
  pi.product_category,
  pi.amount as amount_pre_vat,
  p.is_cancelled
from project_items pi
join projects p on p.id = pi.project_id
join customers c on c.id = p.customer_id
join sales_reps sr on sr.id = p.sales_rep_id;

comment on view ai.sales_items is 'ยอดขายแยกประเภทสินค้า (1 แถวต่อ JOB ต่อประเภทสินค้า) — ผลรวม amount_pre_vat ของ JOB เดียวกันเท่ากับ pre_vat ใน ai.sales';

-- ============ ai.projects — job status + billing/collection progress ============

create or replace view ai.projects as
select
  p.job_no,
  p.project_date,
  c.name as customer_name,
  p.customer_type,
  sr.name as sales_rep,
  p.project_name,
  p.production_status,
  p.is_cancelled,
  p.total,
  coalesce(pm.installments_count, 0) as installments_count,
  coalesce(pm.received_count, 0) as received_installments_count,
  pm.payment_status,
  pm.outstanding_amount,
  pm.last_received_date,
  pm.billing_note_nos,
  pm.tax_invoice_nos,
  pm.receipt_nos
from projects p
join customers c on c.id = p.customer_id
join sales_reps sr on sr.id = p.sales_rep_id
left join lateral (
  select
    count(*) as installments_count,
    count(*) filter (where pay.receipt_no is not null) as received_count,
    (array_agg(pay.status order by pay.installment_no))[1] as payment_status,
    (array_agg(pay.outstanding_amount order by pay.installment_no))[1] as outstanding_amount,
    max(pay.received_date) as last_received_date,
    string_agg(distinct pay.billing_note_no, ', ') as billing_note_nos,
    string_agg(distinct pay.tax_invoice_no, ', ') as tax_invoice_nos,
    string_agg(distinct pay.receipt_no, ', ') as receipt_nos
  from payments pay
  where pay.project_id = p.id
) pm on true;

comment on view ai.projects is 'สถานะงาน + ความคืบหน้าการวางบิล/เก็บเงิน (1 แถวต่อ 1 JOB)';
comment on column ai.projects.production_status is 'สถานะงาน เช่น รอเงินมัดจำ, กำลังผลิต, ส่งของแล้ว, จบงาน';
comment on column ai.projects.outstanding_amount is 'ยอดคงค้างของทั้ง JOB (บาท) ไม่ใช่ต่อหนึ่งงวด';
comment on column ai.projects.payment_status is 'สถานะการชำระเงิน: เก็บเงินเรียบร้อย / ชำระมาแล้ว 50% / รอชำระเงิน';

-- ============ ai.ar — receivables still outstanding (ลูกหนี้) ============

create or replace view ai.ar as
select
  p.job_no,
  p.project_date,
  c.name as customer_name,
  sr.name as sales_rep,
  p.project_name,
  p.total,
  pm.outstanding_amount,
  pm.payment_status,
  (current_date - p.project_date) as days_since_project_date,
  case
    when current_date - p.project_date <= 30 then '0-30'
    when current_date - p.project_date <= 60 then '31-60'
    when current_date - p.project_date <= 90 then '61-90'
    else '90+'
  end as aging_bucket,
  pm.last_received_date,
  pm.billing_note_nos,
  pm.tax_invoice_nos,
  pm.receipt_nos
from projects p
join customers c on c.id = p.customer_id
join sales_reps sr on sr.id = p.sales_rep_id
join lateral (
  select
    (array_agg(pay.status order by pay.installment_no))[1] as payment_status,
    (array_agg(pay.outstanding_amount order by pay.installment_no))[1] as outstanding_amount,
    max(pay.received_date) as last_received_date,
    string_agg(distinct pay.billing_note_no, ', ') as billing_note_nos,
    string_agg(distinct pay.tax_invoice_no, ', ') as tax_invoice_nos,
    string_agg(distinct pay.receipt_no, ', ') as receipt_nos
  from payments pay
  where pay.project_id = p.id
) pm on true
where not p.is_cancelled
  and coalesce(pm.outstanding_amount, 0) >= 1;

comment on view ai.ar is 'ลูกหนี้ค้างชำระ (เฉพาะ JOB ที่ไม่ยกเลิกและยังค้าง ≥ 1 บาท) — อายุหนี้นับจากวันที่ของ JOB เพราะระบบไม่มีวันครบกำหนดต่อใบแจ้งหนี้';
comment on column ai.ar.days_since_project_date is 'จำนวนวันนับจากวันที่ของ JOB ถึงวันนี้';
comment on column ai.ar.aging_bucket is 'ช่วงอายุหนี้: 0-30, 31-60, 61-90, 90+ วัน';

-- ============ ai.gp — gross profit per costed job ============

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
  from payment_vouchers
  where nullif(trim(job_no), '') is not null
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

comment on view ai.gp is 'กำไรขั้นต้นต่อ JOB (เฉพาะ JOB ที่ไม่ยกเลิกและมีข้อมูลต้นทุน) — profit = pre_vat − total_cost; total_cost = ต้นทุนที่กรอกในฟอร์ม Project Sales + ใบเบิกสินค้า + ใบสำคัญจ่าย + เงินสดย่อยที่ผูก JOB นี้';
comment on column ai.gp.manual_cost_total is 'ต้นทุนที่กรอกเองในฟอร์ม Project Sales (ค่าวัสดุ+กาว+ตัด+ติดตั้ง+เดินทาง+ขนส่ง)';
comment on column ai.gp.requisition_cost is 'ต้นทุนจากใบเบิกสินค้าที่ผูก JOB นี้';
comment on column ai.gp.voucher_cost is 'ต้นทุนจากใบสำคัญจ่ายที่ผูก JOB นี้';
comment on column ai.gp.petty_cash_cost is 'ต้นทุนจากเงินสดย่อย (ใช้จ่าย) ที่ผูก JOB นี้';
comment on column ai.gp.margin_percent is '% กำไร = profit / pre_vat × 100';

-- ============ ai.expenses — payment vouchers + petty cash spending ============
-- Salary and social-security vouchers are excluded: each row is one
-- employee's pay.

create or replace view ai.expenses as
select
  'payment_voucher'::text as source,
  doc_no,
  voucher_date as expense_date,
  to_char(voucher_date, 'YYYY-MM') as month,
  payee_name,
  category,
  description,
  job_no,
  amount,
  wht_amount,
  payment_method
from payment_vouchers
where coalesce(category, '') not in ('เงินเดือน', 'ค่าประกันสังคม')
union all
select
  'petty_cash'::text,
  doc_no,
  transaction_date,
  to_char(transaction_date, 'YYYY-MM'),
  biller_name,
  category,
  description,
  job_no,
  amount,
  wht_amount,
  'เงินสดย่อย'::text
from petty_cash_transactions
where transaction_type = 'expense';

comment on view ai.expenses is 'ค่าใช้จ่าย: ใบสำคัญจ่าย + เงินสดย่อย (เฉพาะรายการใช้จ่าย) — ไม่รวมเงินเดือนและประกันสังคม';
comment on column ai.expenses.source is 'payment_voucher = ใบสำคัญจ่าย, petty_cash = เงินสดย่อย';
comment on column ai.expenses.job_no is 'JOB ที่ผูกค่าใช้จ่ายนี้ (ถ้ามี)';

-- ============ ai.inventory — current stock ============

create or replace view ai.inventory as
select
  sku,
  name,
  category,
  color,
  size,
  thickness,
  unit,
  location,
  quantity_on_hand,
  reorder_point,
  unit_cost,
  quantity_on_hand * unit_cost as stock_value,
  selling_price,
  quantity_on_hand <= 0 as is_out_of_stock,
  quantity_on_hand <= reorder_point as is_low_stock
from stock_products;

comment on view ai.inventory is 'สต๊อกคงเหลือปัจจุบันต่อสินค้า — unit_cost เป็นต้นทุนเฉลี่ยถ่วงน้ำหนัก';
comment on column ai.inventory.is_low_stock is 'true เมื่อคงเหลือ ≤ จุดสั่งซื้อ (รวมสินค้าที่หมดแล้ว)';

-- ============ ai.stock_movement — stock in/out ledger ============

create or replace view ai.stock_movement as
select
  sm.created_at::date as movement_date,
  to_char(sm.created_at, 'YYYY-MM') as month,
  sm.created_at as moved_at,
  sp.sku,
  sp.name as product_name,
  sp.category,
  sm.movement_type,
  sm.quantity,
  sm.balance_before,
  sm.balance_after,
  sm.reference_no,
  sm.note
from stock_movements sm
join stock_products sp on sp.id = sm.stock_product_id;

comment on view ai.stock_movement is 'ความเคลื่อนไหวสต๊อก (รับเข้า/เบิกออก)';
comment on column ai.stock_movement.movement_type is 'in = รับเข้า, out = เบิกออก';
comment on column ai.stock_movement.reference_no is 'เลขที่เอกสารอ้างอิง เช่น ใบเบิกสินค้า (อาจว่างในรายการเก่า)';

-- ============ ai.sales_activity — Sale Report visits/pipeline ============

create or replace view ai.sales_activity as
select
  sl.visit_date,
  to_char(sl.visit_date, 'YYYY-MM') as month,
  sr.name as sales_rep,
  sl.customer_name,
  sl.project_name,
  sl.customer_type,
  sl.project_type,
  sl.stage,
  sl.stage_percent,
  sl.est_value,
  sl.created_at
from sales_leads sl
join sales_reps sr on sr.id = sl.sales_rep_id;

comment on view ai.sales_activity is 'กิจกรรมการขาย/pipeline จาก Sale Report ที่เซลล์รายงานเอง (ไม่ใช่ยอดขายจริง — ยอดขายจริงดูที่ ai.sales)';
comment on column ai.sales_activity.stage is 'นำเสนอ / ใบเสนอราคา / เจรจาต่อรอง / ปิดการขาย / ไม่สำเร็จ';
comment on column ai.sales_activity.est_value is 'มูลค่าประมาณการที่เซลล์ประเมิน (บาท)';

-- ============ Lock down: views are readable only by ai_readonly ============

revoke all on all tables in schema ai from public, anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'ai_readonly') then
    -- No login/password here on purpose — set one yourself (see the
    -- instructions below) so no secret ever lives in this repo.
    create role ai_readonly nologin;
  end if;
end $$;

-- Belt and braces: even if some function were reachable, this role's
-- sessions are read-only and time-limited.
alter role ai_readonly set default_transaction_read_only = on;
alter role ai_readonly set statement_timeout = '15s';
alter role ai_readonly connection limit 5;

grant usage on schema ai to ai_readonly;
grant select on all tables in schema ai to ai_readonly;
alter default privileges in schema ai grant select on tables to ai_readonly;

-- ============ AFTER running this file, run ONE more statement yourself ============
-- (pick your own long random password; do not save it in this file):
--
--   alter role ai_readonly with login password 'YOUR-LONG-RANDOM-PASSWORD';
