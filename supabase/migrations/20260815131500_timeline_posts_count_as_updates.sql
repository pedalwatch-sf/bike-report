-- A timeline entry posted after a follower last checked a report should
-- flag it as updated too, not just a status change. Tracks when each
-- follower last looked (last_seen_at) alongside the status they last saw,
-- and folds both signals into a single has_update flag computed
-- server-side so Browse no longer has to reason about it client-side.
alter table public.subscriber_identities add column last_seen_at timestamptz not null default now();

create or replace function public.mark_subscription_seen(target_suggestion_id uuid)
returns void
language sql
security definer
set search_path to 'public'
as $$
  update subscriber_identities si
  set last_seen_status = s.status,
      last_seen_at = now()
  from suggestions s
  where s.id = si.suggestion_id
    and si.suggestion_id = target_suggestion_id
    and si.user_id = auth.uid();
$$;

drop function public.get_my_subscriptions();

create function public.get_my_subscriptions()
returns table(suggestion_id uuid, added_at timestamptz, last_seen_status text, has_update boolean)
language sql
stable
security definer
set search_path to 'public'
as $$
  select
    s.suggestion_id,
    s.added_at,
    si.last_seen_status,
    (
      si.last_seen_status is distinct from sug.status
      or exists (
        select 1 from updates u
        where u.suggestion_id = s.suggestion_id and u.created_at > si.last_seen_at
      )
    ) as has_update
  from subscribers s
  join subscriber_identities si on si.subscriber_id = s.id
  join suggestions sug on sug.id = s.suggestion_id
  where si.user_id = auth.uid()
  order by s.added_at desc;
$$;

revoke all on function public.get_my_subscriptions() from public;
grant execute on function public.get_my_subscriptions() to authenticated;
