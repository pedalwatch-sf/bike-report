-- Backs a red dot on the Nav bar's Moderate tab, visible from any page,
-- so a moderator knows something needs attention without having to open
-- Moderate first. Deliberately a single cheap count query (not the full
-- row data Moderate itself loads) since Nav renders on every page.
-- Counts pending reports + pending change suggestions always; pending
-- moderator-access requests only for admins, since only admins can act
-- on those (plain moderators can't see or approve them either, in
-- Moderate's own User accounts tab).
create or replace function public.get_moderation_pending_count()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if not is_moderator_or_admin(auth.uid()) then
    raise exception 'not authorized';
  end if;

  select
    (select count(*) from suggestions where status = 'pending')
    + (select count(*) from change_suggestions where status = 'pending')
    + case when is_admin(auth.uid()) then (select count(*) from profiles where moderator_status = 'pending') else 0 end
  into v_count;

  return v_count;
end;
$$;

revoke all on function public.get_moderation_pending_count() from public;
grant execute on function public.get_moderation_pending_count() to authenticated;
