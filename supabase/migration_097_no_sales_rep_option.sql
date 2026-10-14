-- A "ไม่มีเซลล์" choice for the เซลล์ dropdown on Koonway Project Sales (and
-- the other forms that pick a sales rep) — for jobs that came in with no
-- salesperson. Same approach as the existing pseudo-reps (e.g. "Support"):
-- an ordinary sales_reps row, so projects.sales_rep_id stays NOT NULL and
-- every report that joins the rep name keeps working untouched. The
-- commission report skips jobs under this name (no salesperson, no
-- commission) — see getCommissionableProjects.
insert into sales_reps (name, active)
select 'ไม่มีเซลล์', true
where not exists (select 1 from sales_reps where name = 'ไม่มีเซลล์');
