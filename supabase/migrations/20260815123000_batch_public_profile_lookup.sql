-- Batched counterpart to get_public_profile: lets Browse and Moderate
-- resolve display names for a whole page of reports in one round trip
-- instead of one call per reporter. Same public-safe shape (id +
-- display_name only, never email/role).
create or replace function public.get_public_profiles(p_user_ids uuid[])
returns table (id uuid, display_name text)
language sql
security definer
set search_path = public
stable
as $$
  select id, display_name from profiles where id = any(p_user_ids);
$$;

grant execute on function public.get_public_profiles(uuid[]) to anon, authenticated;
