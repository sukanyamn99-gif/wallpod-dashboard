alter table quotations add column accepted_at timestamptz;

-- Best-effort backfill for quotations already accepted before this column
-- existed — created_at is an honest approximation (not a fabricated exact
-- acceptance time), just enough so ใบลงผลิต's "newest accepted first" sort
-- doesn't bury old rows arbitrarily.
update quotations set accepted_at = created_at where status = 'ลูกค้าตอบตกลง' and accepted_at is null;
