-- Snapshot the product's unit cost at the moment it's withdrawn on a
-- requisition — until now stock_requisition_items tracked quantity only,
-- so any cost figure derived from it (e.g. getMaterialCostByJobNo) had to
-- fall back to the product's CURRENT weighted-average cost, which drifts
-- over time and misrepresents what a requisition actually cost when it was
-- submitted. Existing rows default to 0 (an honest gap, not backfilled)
-- and readers fall back to the live stock_products.unit_cost for those.
alter table stock_requisition_items add column unit_cost numeric(14,2) not null default 0;
