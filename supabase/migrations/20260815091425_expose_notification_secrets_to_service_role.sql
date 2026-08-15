-- vault isn't exposed via PostgREST (by design -- it shouldn't be), so
-- the edge function can't query vault.decrypted_secrets directly through
-- supabase-js. This narrow function stands in: it returns only the two
-- secrets the notify-status-change function needs, and only service_role
-- (the edge function's own auto-injected credential) can call it.
create or replace function public.get_notification_secrets()
returns table(name text, value text)
language sql
security definer
set search_path = public
as $$
  select name, decrypted_secret from vault.decrypted_secrets
  where name in ('resend_api_key', 'webhook_shared_secret');
$$;

revoke all on function public.get_notification_secrets() from public, anon, authenticated;
grant execute on function public.get_notification_secrets() to service_role;
