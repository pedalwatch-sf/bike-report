-- In-app "updated" indicator for followed reports: track the status a
-- user last saw for each subscription, so My Interests can flag ones
-- that changed since. No email/external service involved.

alter table public.subscriber_identities add column last_seen_status text;

update public.subscriber_identities si
set last_seen_status = s.status
from public.suggestions s
where s.id = si.suggestion_id and si.last_seen_status is null;

create or replace function public.register_interest(target_suggestion_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  new_id uuid;
  current_status text;
begin
  if auth.uid() is null then
    raise exception 'sign in required';
  end if;
  if is_banned(auth.uid()) then
    raise exception 'not authorized';
  end if;
  select status into current_status from suggestions where id = target_suggestion_id;
  if current_status is null then
    raise exception 'report not found';
  end if;
  if exists (
    select 1 from subscriber_identities
    where suggestion_id = target_suggestion_id and user_id = auth.uid()
  ) then
    return;
  end if;

  insert into subscribers (suggestion_id) values (target_suggestion_id) returning id into new_id;
  insert into subscriber_identities (subscriber_id, suggestion_id, user_id, last_seen_status)
  values (new_id, target_suggestion_id, auth.uid(), current_status);
end;
$$;

drop function public.get_my_subscriptions();

create function public.get_my_subscriptions()
returns table(suggestion_id uuid, added_at timestamptz, last_seen_status text)
language sql
stable
security definer
set search_path to 'public'
as $$
  select s.suggestion_id, s.added_at, si.last_seen_status
  from subscribers s
  join subscriber_identities si on si.subscriber_id = s.id
  where si.user_id = auth.uid()
  order by s.added_at desc;
$$;

revoke all on function public.get_my_subscriptions() from public;
grant execute on function public.get_my_subscriptions() to authenticated;

create or replace function public.mark_subscriptions_seen()
returns void
language sql
security definer
set search_path to 'public'
as $$
  update subscriber_identities si
  set last_seen_status = s.status
  from suggestions s
  where s.id = si.suggestion_id and si.user_id = auth.uid();
$$;

revoke all on function public.mark_subscriptions_seen() from public;
grant execute on function public.mark_subscriptions_seen() to authenticated;
