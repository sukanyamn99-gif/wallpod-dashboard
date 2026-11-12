-- Whether a job's commission has been paid out yet, and when.
alter table commission_entries add column if not exists paid boolean not null default false;
alter table commission_entries add column if not exists paid_date date;
