create table sales_lead_change_log (
  id uuid primary key default gen_random_uuid(),
  sale_lead_id uuid references sales_leads(id) on delete set null,
  action text not null check (action in ('update', 'delete')),
  sales_rep_id uuid not null references sales_reps(id),
  customer_name text not null,
  changed_by uuid references profiles(id),
  before_snapshot jsonb not null,
  created_at timestamptz not null default now()
);

alter table sales_lead_change_log enable row level security;

create policy sales_lead_change_log_select on sales_lead_change_log for select
  using (my_role() in ('owner','manager') or sales_rep_id = my_sales_rep_id());

create policy sales_lead_change_log_insert on sales_lead_change_log for insert
  with check (my_role() in ('owner','manager') or sales_rep_id = my_sales_rep_id());
