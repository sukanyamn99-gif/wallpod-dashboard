-- Lets a ใบลงผลิต (production order — an accepted quotation shown on the
-- production page) be cancelled without touching the quotation's own
-- status. quotations.status already means something else
-- (รอตอบรับ/ลูกค้าตอบตกลง/ปฏิเสธ — ปฏิเสธ is "the customer rejected the
-- quote", a different event from "production on an already-accepted job
-- got called off") — this is a separate, reversible flag, same pattern as
-- projects.is_cancelled.
alter table quotations
  add column production_cancelled boolean not null default false;
