-- ทีม Support (support_sale) also works the payroll and commission tables like
-- ธุรการบัญชี (account) — the four tables migration_101 deliberately left out.
-- Same approach as migration_101: wherever a policy lets 'account' through but
-- not 'support_sale', let 'support_sale' through too. Idempotent.
do $$
declare
  pol record;
  new_qual text;
  new_check text;
  stmt text;
  changed int := 0;
begin
  for pol in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and tablename in ('employees', 'payroll_entries', 'commission_rate_tiers', 'commission_entries')
      and (
        (qual like '%''account''::text%' and qual not like '%support_sale%')
        or (with_check like '%''account''::text%' and with_check not like '%support_sale%')
      )
  loop
    new_qual := case when pol.qual like '%''account''::text%' and pol.qual not like '%support_sale%'
      then replace(pol.qual, '''account''::text', '''account''::text, ''support_sale''::text') else pol.qual end;
    new_check := case when pol.with_check like '%''account''::text%' and pol.with_check not like '%support_sale%'
      then replace(pol.with_check, '''account''::text', '''account''::text, ''support_sale''::text') else pol.with_check end;
    stmt := format('alter policy %I on %I.%I', pol.policyname, pol.schemaname, pol.tablename)
      || case when new_qual is not null then ' using (' || new_qual || ')' else '' end
      || case when new_check is not null then ' with check (' || new_check || ')' else '' end;
    begin
      execute stmt;
      changed := changed + 1;
    exception when others then
      raise notice 'skipped policy % on %: %', pol.policyname, pol.tablename, sqlerrm;
    end;
  end loop;

  raise notice 'widened % payroll/commission policies for support_sale', changed;
end
$$;
