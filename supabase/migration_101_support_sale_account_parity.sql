-- ทีม Support (support_sale) works like ธุรการบัญชี (account): wherever a
-- row-level-security policy or a security-definer function lets 'account'
-- through but not 'support_sale', let 'support_sale' through too.
--
-- Deliberately NOT widened: payroll / employees (everyone's salary) and the
-- commission tables (the ทีม Support payout itself) — see the same exclusion
-- in src/lib/permissions.ts. Idempotent: anything already naming
-- 'support_sale' is skipped, so it is safe to run twice.
do $$
declare
  p record;
  f record;
  new_qual text;
  new_check text;
  stmt text;
  changed int := 0;
begin
  -- Policies (public + storage).
  for p in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where schemaname in ('public', 'storage')
      and tablename not in ('employees', 'payroll_entries', 'commission_rate_tiers', 'commission_entries')
      and (
        (qual like '%''account''::text%' and qual not like '%support_sale%')
        or (with_check like '%''account''::text%' and with_check not like '%support_sale%')
      )
  loop
    new_qual := case when p.qual like '%''account''::text%' and p.qual not like '%support_sale%'
      then replace(p.qual, '''account''::text', '''account''::text, ''support_sale''::text') else p.qual end;
    new_check := case when p.with_check like '%''account''::text%' and p.with_check not like '%support_sale%'
      then replace(p.with_check, '''account''::text', '''account''::text, ''support_sale''::text') else p.with_check end;
    stmt := format('alter policy %I on %I.%I', p.policyname, p.schemaname, p.tablename)
      || case when new_qual is not null then ' using (' || new_qual || ')' else '' end
      || case when new_check is not null then ' with check (' || new_check || ')' else '' end;
    begin
      execute stmt;
      changed := changed + 1;
    exception when others then
      raise notice 'skipped policy % on %.%: %', p.policyname, p.schemaname, p.tablename, sqlerrm;
    end;
  end loop;

  -- Security-definer functions (e.g. the petty-cash writers) that gate on role.
  for f in
    select fn.oid, fn.proname
    from pg_proc fn
    join pg_namespace ns on ns.oid = fn.pronamespace
    where ns.nspname = 'public'
      and fn.prosrc like '%''account''%'
      and fn.prosrc not like '%support_sale%'
      and fn.prosrc like '%my_role()%'
  loop
    begin
      execute replace(pg_get_functiondef(f.oid), '''account''', '''account'', ''support_sale''');
      changed := changed + 1;
    exception when others then
      raise notice 'skipped function %: %', f.proname, sqlerrm;
    end;
  end loop;

  raise notice 'widened % policies/functions for support_sale', changed;
end
$$;
