-- Per explicit decision: the AI read-only API should not expose individual
-- payment vouchers / petty cash rows. migration_093 originally created
-- ai.expenses; databases that already ran it need this to remove it.
-- (ai.gp still includes per-job cost totals, which is intended.)

drop view if exists ai.expenses;
