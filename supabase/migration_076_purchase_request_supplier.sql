-- ใบขอซื้อ gains a header-level ผู้จำหน่าย (one supplier for the whole
-- document), alongside the existing per-item supplier_id on
-- purchase_request_items — replaces the koonway_ref_no/flexiplan_ref_no
-- fields in the UI, which stay as unused columns rather than being dropped.
alter table purchase_requests
  add column supplier_id uuid references suppliers(id) on delete set null;
