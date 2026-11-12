-- The support team (support_sale) may add a supplier (e.g. from the purchase
-- request form) but not edit or delete one — that stays owner/manager only.
create policy suppliers_insert_support on suppliers for insert
  with check (my_role() = 'support_sale');
