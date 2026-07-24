create policy profiles_insert on profiles for insert
  with check (my_role() = 'owner');
