-- commission_entries_select/commission_rate_tiers_select already allowed
-- account (ธุรการบัญชี), but both *_write policies were still owner/manager
-- only — the page lets account enter a discount % and save, but every save
-- was silently rejected by RLS ("new row violates row-level security
-- policy"). Widening both together since they're the same feature/page.
drop policy if exists commission_entries_write on commission_entries;
create policy commission_entries_write on commission_entries for all
  using (my_role() in ('owner', 'manager', 'account')) with check (my_role() in ('owner', 'manager', 'account'));

drop policy if exists commission_rate_tiers_write on commission_rate_tiers;
create policy commission_rate_tiers_write on commission_rate_tiers for all
  using (my_role() in ('owner', 'manager', 'account')) with check (my_role() in ('owner', 'manager', 'account'));
