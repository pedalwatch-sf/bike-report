-- subscriber_identities holds the sensitive columns (email/user_id) fully
-- locked down; subscribers stays public-safe (id, suggestion_id, added_at
-- only) so PostgREST's embedded count() -- which needs whole-row access to
-- the table it counts -- keeps working with a plain full SELECT grant.

create table public.subscriber_identities (
  subscriber_id uuid primary key references public.subscribers(id) on delete cascade,
  suggestion_id uuid not null references public.suggestions(id) on delete cascade,
  user_id uuid references auth.users(id),
  email text
);

create unique index subscriber_identities_suggestion_user_unique
  on public.subscriber_identities (suggestion_id, user_id)
  where user_id is not null;

alter table public.subscriber_identities enable row level security;

insert into public.subscriber_identities (subscriber_id, suggestion_id, user_id, email)
select id, suggestion_id, user_id, email from public.subscribers
where user_id is not null or email is not null;

drop index if exists public.subscribers_user_suggestion_unique;
alter table public.subscribers drop column email;
alter table public.subscribers drop column user_id;

revoke insert, update, delete on public.subscribers from anon, authenticated;
revoke all on public.subscriber_identities from anon, authenticated;

create or replace function public.register_interest(target_suggestion_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  new_id uuid;
begin
  if auth.uid() is null then
    raise exception 'sign in required';
  end if;
  if is_banned(auth.uid()) then
    raise exception 'not authorized';
  end if;
  if not exists (select 1 from suggestions where id = target_suggestion_id) then
    raise exception 'report not found';
  end if;
  if exists (
    select 1 from subscriber_identities
    where suggestion_id = target_suggestion_id and user_id = auth.uid()
  ) then
    return;
  end if;

  insert into subscribers (suggestion_id) values (target_suggestion_id) returning id into new_id;
  insert into subscriber_identities (subscriber_id, suggestion_id, user_id)
  values (new_id, target_suggestion_id, auth.uid());
end;
$$;

create or replace function public.unregister_interest(target_suggestion_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if auth.uid() is null then
    raise exception 'sign in required';
  end if;

  delete from subscribers
  where id in (
    select subscriber_id from subscriber_identities
    where suggestion_id = target_suggestion_id and user_id = auth.uid()
  );
end;
$$;

create or replace function public.get_my_subscriptions()
returns table(suggestion_id uuid, added_at timestamptz)
language sql
stable
security definer
set search_path to 'public'
as $$
  select s.suggestion_id, s.added_at
  from subscribers s
  join subscriber_identities si on si.subscriber_id = s.id
  where si.user_id = auth.uid()
  order by s.added_at desc;
$$;

create or replace function public.get_report_subscribers(target_suggestion_id uuid)
returns table(email text, added_at timestamptz)
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not is_moderator_or_admin(auth.uid()) then
    raise exception 'not authorized';
  end if;

  return query
    select coalesce(u.email, si.email)::text, s.added_at
    from subscribers s
    join subscriber_identities si on si.subscriber_id = s.id
    left join auth.users u on u.id = si.user_id
    where s.suggestion_id = target_suggestion_id
    order by s.added_at asc;
end;
$$;
