drop policy "read updates for visible reports" on public.updates;
create policy "read updates for visible reports" on public.updates
  for select
  using (exists (
    select 1 from suggestions s
    where s.id = updates.suggestion_id
      and (s.status in ('approved', 'resolved') or s.user_id = auth.uid() or is_moderator_or_admin(auth.uid()))
  ));

create or replace function public.get_timeline_updates(p_suggestion_id uuid)
returns table(id uuid, suggestion_id uuid, message text, created_at timestamptz, created_by_email text)
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not exists (
    select 1 from suggestions s
    where s.id = p_suggestion_id
      and (s.status in ('approved', 'resolved') or s.user_id = auth.uid() or is_moderator_or_admin(auth.uid()))
  ) then
    return;
  end if;

  return query
    select u.id, u.suggestion_id, u.message, u.created_at,
      case when is_moderator_or_admin(auth.uid()) then u.created_by_email else null end
    from updates u
    where u.suggestion_id = p_suggestion_id
    order by u.created_at asc;
end;
$$;
