-- replace_all_projects (the Excel full-ledger-replace RPC, migration_020)
-- never carried receipt_no (migration_030) or received_date (migration_031)
-- through its payments insert — an export -> edit -> import round-trip
-- silently dropped both fields. Same parameter list, so `create or replace`
-- is safe here (no `drop function` needed).
create or replace function replace_all_projects(p_rows jsonb)
returns int language plpgsql security definer as $$
declare
  v_row jsonb;
  v_project_id uuid;
  v_count int := 0;
begin
  if coalesce(my_role(), '') <> 'owner' then
    raise exception 'permission denied';
  end if;

  delete from projects; -- cascades project_items, project_costs, payments

  for v_row in select * from jsonb_array_elements(p_rows)
  loop
    insert into projects (job_no, project_date, customer_id, project_name, sales_rep_id, customer_type, stage_percent, pre_vat, vat, production_status)
    values (
      nullif(v_row->>'jobNo', ''), (v_row->>'projectDate')::date, (v_row->>'customerId')::uuid,
      v_row->>'projectName', (v_row->>'salesRepId')::uuid, v_row->>'customerType', 100,
      (v_row->>'preVat')::numeric, (v_row->>'vat')::numeric, nullif(v_row->>'productionStatus', '')
    )
    returning id into v_project_id;

    insert into project_items (project_id, product_category, amount)
    select v_project_id, item->>'category', (item->>'amount')::numeric
    from jsonb_array_elements(v_row->'items') as item;

    if jsonb_typeof(v_row->'costs') = 'object' then
      insert into project_costs (project_id, material_cost, glue_cost, cutting_cost, install_cost, parking_cost, shipping_cost)
      values (
        v_project_id, (v_row->'costs'->>'material')::numeric, (v_row->'costs'->>'glue')::numeric,
        (v_row->'costs'->>'cutting')::numeric, (v_row->'costs'->>'install')::numeric,
        (v_row->'costs'->>'parking')::numeric, (v_row->'costs'->>'shipping')::numeric
      );
    end if;

    if jsonb_array_length(coalesce(v_row->'payments', '[]'::jsonb)) > 0 then
      insert into payments (project_id, invoice_no, installment_no, amount, paid_date, status, outstanding_amount, receipt_no, received_date)
      select v_project_id, nullif(p->>'invoiceNo', ''), (p->>'installmentNo')::int, (p->>'amount')::numeric,
             nullif(p->>'paidDate', '')::date, p->>'status', (p->>'outstandingAmount')::numeric,
             nullif(p->>'receiptNo', ''), nullif(p->>'receivedDate', '')::date
      from jsonb_array_elements(v_row->'payments') as p;
    end if;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;
