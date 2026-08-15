-- Moderate's User accounts list previously read straight from profiles,
-- which gets a row the instant someone submits the signup form -- before
-- they've confirmed their email at all, since auth.users creates the row
-- immediately and only fills in email_confirmed_at once the link is
-- clicked. There was no way to tell the two apart in the UI. This RPC
-- replaces the direct table read with the same profiles + email_confirmed_at
-- from auth.users, and keeps the exact same visibility rule the RLS
-- policies already enforced (admins see everyone, moderators see
-- role='user' only).
create or replace function public.get_users_for_moderation()
returns table (
  id uuid,
  email text,
  role text,
  moderator_status text,
  display_name text,
  banned boolean,
  created_at timestamptz,
  email_confirmed_at timestamptz
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
    select p.id, p.email, p.role, p.moderator_status, p.display_name, p.banned, p.created_at, u.email_confirmed_at
    from profiles p
    join auth.users u on u.id = p.id
    where is_admin(auth.uid()) or p.role = 'user'
    order by p.created_at desc;
end;
$$;

revoke all on function public.get_users_for_moderation() from public;
grant execute on function public.get_users_for_moderation() to authenticated;
