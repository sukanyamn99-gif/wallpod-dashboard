-- A job's payment status could only be one of three fixed words, so a job paid
-- 40% up front could not be marked as such (the middle choice was "ชำระมาแล้ว
-- 50%"). Allow "ชำระมาแล้ว N%" for any N (e.g. 'ชำระมาแล้ว 40%') as well, on both
-- the job (projects.payment_status) and its installments (payments.status).
-- เก็บเงินเรียบร้อย and รอชำระเงิน keep their meaning, so commission/incentive
-- (which count only เก็บเงินเรียบร้อย) are unaffected.

-- The old checks were created inline, so find them by what they say rather than
-- by a name that could differ between databases.
do $$
declare c record;
begin
  for c in
    select conrelid::regclass as tbl, conname
    from pg_constraint
    where contype = 'c'
      and conrelid in ('payments'::regclass, 'projects'::regclass)
      and pg_get_constraintdef(oid) like '%ชำระมาแล้ว 50%'
  loop
    execute format('alter table %s drop constraint %I', c.tbl, c.conname);
  end loop;
end $$;

-- (Safe to run twice: drops the new-style checks too before adding them.)
alter table payments drop constraint if exists payments_status_check;
alter table projects drop constraint if exists projects_payment_status_check;

alter table payments
  add constraint payments_status_check check (
    status in ('เก็บเงินเรียบร้อย', 'รอชำระเงิน')
    or status ~ '^ชำระมาแล้ว [0-9]{1,2}(\.[0-9]{1,2})?%$'
  );

alter table projects
  add constraint projects_payment_status_check check (
    payment_status is null
    or payment_status in ('เก็บเงินเรียบร้อย', 'รอชำระเงิน')
    or payment_status ~ '^ชำระมาแล้ว [0-9]{1,2}(\.[0-9]{1,2})?%$'
  );
