-- Replace the bulk "mark everything seen the moment you open the list"
-- behavior with per-report marking, so a followed report's "Updated"
-- indicator only clears once you actually open that report, not just the
-- Following pill.
create or replace function public.mark_subscription_seen(target_suggestion_id uuid)
returns void
language sql
security definer
set search_path to 'public'
as $$
  update subscriber_identities si
  set last_seen_status = s.status
  from suggestions s
  where s.id = si.suggestion_id
    and si.suggestion_id = target_suggestion_id
    and si.user_id = auth.uid();
$$;

revoke all on function public.mark_subscription_seen(uuid) from public;
grant execute on function public.mark_subscription_seen(uuid) to authenticated;

drop function if exists public.mark_subscriptions_seen();
