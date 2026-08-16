-- Timeline updates only ever stored the poster's raw email
-- (created_by_email, set client-side at insert time). Both RPCs that
-- read the timeline surfaced that: moderators saw a bare email,
-- everyone else saw nothing at all, even though who posted an update
-- isn't sensitive -- a moderator's display name is already public
-- everywhere else (their own profile, the audit log). Adds created_by,
-- defaulting to auth.uid() so future inserts capture it automatically,
-- best-effort backfilled from created_by_email for existing rows.
alter table public.updates add column created_by uuid references auth.users(id);
alter table public.updates alter column created_by set default auth.uid();

update public.updates u
set created_by = usr.id
from auth.users usr
where u.created_by is null and u.created_by_email is not null and usr.email = u.created_by_email;

-- Both RPCs now also return created_by_display_name, resolved from
-- profiles and shown to every viewer; created_by_email stays
-- moderator-only, exactly as before. Return type changed (new output
-- column), so the old signatures have to be dropped first.
drop function if exists public.get_timeline_updates(uuid);
drop function if exists public.get_all_timeline_updates_for_moderation();

create or replace function public.get_timeline_updates(p_suggestion_id uuid)
returns table(
  id uuid,
  suggestion_id uuid,
  message text,
  created_at timestamptz,
  created_by_email text,
  created_by_display_name text
)
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
      case when is_moderator_or_admin(auth.uid()) then u.created_by_email else null end,
      p.display_name
    from updates u
    left join profiles p on p.id = u.created_by
    where u.suggestion_id = p_suggestion_id
    order by u.created_at asc;
end;
$$;

grant execute on function public.get_timeline_updates(uuid) to anon, authenticated;

create or replace function public.get_all_timeline_updates_for_moderation()
returns table (
  id uuid,
  suggestion_id uuid,
  message text,
  created_by_email text,
  created_by_display_name text,
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
    select u.id, u.suggestion_id, u.message, u.created_by_email, p.display_name, u.created_at
    from updates u
    left join profiles p on p.id = u.created_by
    order by u.created_at asc;
end;
$$;
