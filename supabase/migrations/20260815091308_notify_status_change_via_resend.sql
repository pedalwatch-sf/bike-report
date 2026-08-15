-- Emails a report's followers when its status changes, via the
-- notify-status-change edge function calling Resend. The actual Resend
-- API key and the shared secret authenticating this trigger's call to
-- the function both live in Supabase Vault (set separately, not in
-- migration history) -- this migration only references them by name.
create extension if not exists pg_net;

create or replace function public.notify_report_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  webhook_secret text;
  function_url text := 'https://wtlgeaxxgewhuwjhlemv.supabase.co/functions/v1/notify-status-change';
begin
  if new.status is distinct from old.status then
    select decrypted_secret into webhook_secret
    from vault.decrypted_secrets where name = 'webhook_shared_secret';

    perform net.http_post(
      url := function_url,
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', webhook_secret),
      body := jsonb_build_object(
        'suggestion_id', new.id,
        'old_status', old.status,
        'new_status', new.status,
        'title', new.title
      )
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_report_status_change on public.suggestions;
create trigger trg_notify_report_status_change
after update on public.suggestions
for each row
execute function public.notify_report_status_change();
