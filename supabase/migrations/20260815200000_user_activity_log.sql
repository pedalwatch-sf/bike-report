-- Lets a moderator (or above) viewing someone's public profile see that
-- person's own suggestion/moderation activity -- same private.activity_log
-- table and moderator-only gate as get_activity_log() (Moderate's Activity
-- tab), just filtered to one actor. p_target_id (not target_id) to avoid
-- colliding with the returned target_id column.
create or replace function public.get_user_activity_log(p_target_id uuid)
returns table (
  id uuid,
  action text,
  target_type text,
  target_id uuid,
  detail jsonb,
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
    select l.id, l.action, l.target_type, l.target_id, l.detail, l.created_at
    from private.activity_log l
    where l.actor_id = p_target_id
    order by l.created_at desc
    limit 300;
end;
$$;

revoke all on function public.get_user_activity_log(uuid) from public;
grant execute on function public.get_user_activity_log(uuid) to authenticated;
