-- Let RLS allow the rows to be counted...
create policy "anyone can see subscriber counts"
  on subscribers for select
  using (true);

-- ...but revoke column-level access to the email itself, so the public
-- API can compute counts without ever being able to read the addresses.
revoke select on subscribers from anon, authenticated;
grant select (id, suggestion_id, added_at) on subscribers to anon, authenticated;
