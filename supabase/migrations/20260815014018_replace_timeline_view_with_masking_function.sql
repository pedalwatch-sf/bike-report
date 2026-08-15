drop view public.timeline_updates;

create or replace function public.get_timeline_updates(p_suggestion_id uuid)
returns table (
  id uuid,
  suggestion_id uuid,
  message text,
  created_at timestamptz,
  created_by_email text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from suggestions s
    where s.id = p_suggestion_id
      and (s.status = 'approved' or s.user_id = auth.uid() or is_moderator_or_admin(auth.uid()))
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

grant execute on function public.get_timeline_updates(uuid) to anon, authenticated;
