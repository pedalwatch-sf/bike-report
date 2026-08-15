alter table public.profiles add column display_name text
  check (display_name is null or char_length(display_name) <= 60);

-- Lets a user set their own display name without opening a general
-- self-UPDATE policy on profiles (which would also let them rewrite
-- their own role/moderator_status, since the base table already has
-- a broad UPDATE grant from setup).
create or replace function public.set_display_name(new_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if new_name is not null and char_length(trim(new_name)) > 60 then
    raise exception 'display name too long';
  end if;
  update profiles set display_name = nullif(trim(new_name), '') where id = auth.uid();
end;
$$;

grant execute on function public.set_display_name(text) to authenticated;

-- Public-safe profile lookup: name + join date only, never email/role.
create or replace function public.get_public_profile(p_user_id uuid)
returns table (id uuid, display_name text, created_at timestamptz)
language sql
security definer
set search_path = public
stable
as $$
  select id, display_name, created_at from profiles where id = p_user_id;
$$;

grant execute on function public.get_public_profile(uuid) to anon, authenticated;
