revoke select on public.updates from anon, authenticated;
grant select (id, suggestion_id, message, created_at) on public.updates to anon, authenticated;
