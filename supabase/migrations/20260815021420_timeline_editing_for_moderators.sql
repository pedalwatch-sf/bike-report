create policy "moderators and admins can edit updates"
on public.updates for update
using (is_moderator_or_admin(auth.uid()));

create policy "moderators and admins can delete updates"
on public.updates for delete
using (is_moderator_or_admin(auth.uid()));

create or replace function public.get_all_timeline_updates_for_moderation()
returns table (
  id uuid,
  suggestion_id uuid,
  message text,
  created_by_email text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_moderator_or_admin(auth.uid()) then
    raise exception 'not authorized';
  end if;

  return query
    select u.id, u.suggestion_id, u.message, u.created_by_email, u.created_at
    from updates u
    order by u.created_at asc;
end;
$$;
