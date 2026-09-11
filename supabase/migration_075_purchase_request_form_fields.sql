-- Matches the real ใบขอซื้อ paper form: a PROJECT (JOB NO./project name)
-- reference, two optional secondary reference numbers, and per-item
-- supplier + unit price (the requester already knows/suggests these when
-- asking to buy job-specific material, unlike a generic office-supply
-- request) — none of which the first pass of this feature captured.
alter table purchase_requests
  add column job_no text,
  add column project_name text,
  add column koonway_ref_no text,
  add column flexiplan_ref_no text;

alter table purchase_request_items
  add column supplier_id uuid references suppliers(id) on delete set null,
  add column unit_price numeric(14,2) not null default 0;
