-- The standard "Remark" lines printed on a quotation came only from the
-- per-type template (Settings > Documents), so one quotation could not word them
-- differently. This adds an optional per-quotation copy of those lines.
--
-- null  = print the template's current lines (so later edits to the template
--         still reach every quotation that was never customised)
-- array = print exactly these lines, [{"text": "...", "tone": "normal|red|amber"}]
alter table public.quotations
  add column if not exists print_notes jsonb;
