-- WHT already withheld/settled via a WHT certificate for an installment —
-- money the company will never collect as cash but which is NOT still owed
-- either. Without this, an installment marked received still leaves a gap
-- between its (post-WHT) amount and the job's gross total, which reads as
-- "still outstanding" even though the job is fully settled.
alter table payments add column wht_amount numeric(14,2) not null default 0;
