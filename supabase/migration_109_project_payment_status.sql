-- The payment status picked on the Project Sales form, kept on the job itself.
-- It used to live only on the job's installment rows, so a job with no
-- installment yet (no invoice opened) lost the status the moment it was saved.
alter table projects add column if not exists payment_status text
  check (payment_status in ('เก็บเงินเรียบร้อย', 'ชำระมาแล้ว 50%', 'รอชำระเงิน'));

-- Jobs that already have installments: copy the status they currently show.
update projects p
set payment_status = (
  select pay.status from payments pay
  where pay.project_id = p.id and pay.status is not null
  order by pay.installment_no limit 1
)
where p.payment_status is null;
