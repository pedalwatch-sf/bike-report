alter table public.subscribers add column user_id uuid references auth.users(id);

create unique index subscribers_user_suggestion_unique
  on public.subscribers (suggestion_id, user_id)
  where user_id is not null;

drop policy "anyone can register interest" on public.subscribers;

revoke all on public.subscribers from anon, authenticated;
grant select (id, suggestion_id, added_at) on public.subscribers to anon, authenticated;

create or replace function public.register_interest(target_suggestion_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
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

  insert into subscribers (suggestion_id, user_id)
  values (target_suggestion_id, auth.uid())
  on conflict (suggestion_id, user_id) where user_id is not null do nothing;
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
  where suggestion_id = target_suggestion_id and user_id = auth.uid();
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
  where s.user_id = auth.uid()
  order by s.added_at desc;
$$;

revoke all on function public.register_interest(uuid) from public;
grant execute on function public.register_interest(uuid) to authenticated;
revoke all on function public.unregister_interest(uuid) from public;
grant execute on function public.unregister_interest(uuid) to authenticated;
revoke all on function public.get_my_subscriptions() from public;
grant execute on function public.get_my_subscriptions() to authenticated;
