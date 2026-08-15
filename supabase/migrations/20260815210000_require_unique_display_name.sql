-- Display names were previously optional (many existing accounts have
-- none) and unenforced for uniqueness. Since they're shown publicly as
-- report/timeline/activity attribution, signup now requires one, and
-- names must be unique app-wide going forward. A partial unique index
-- (skipping nulls) is the real enforcement -- existing nameless accounts
-- are untouched, but every new signup and every future rename (self or
-- moderator) that would collide with an existing name is rejected.
create unique index if not exists profiles_display_name_unique_idx
  on public.profiles (lower(trim(display_name)))
  where display_name is not null;

-- Client-side pre-check before calling auth.signUp, so a taken name is
-- caught with a clear message instead of relying on how GoTrue surfaces
-- (or doesn't) an exception raised inside the on_auth_user_created
-- trigger. Safe to expose to anon -- same class of info as any
-- username-availability check, and display names are already public.
create or replace function public.is_display_name_taken(p_name text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from profiles where lower(trim(display_name)) = lower(trim(p_name))
  );
$$;

revoke all on function public.is_display_name_taken(text) from public;
grant execute on function public.is_display_name_taken(text) to anon, authenticated;

-- Reads the display name out of signUp's options.data (raw_user_meta_data)
-- and requires it -- the unique index above is the actual race-safe
-- enforcement, this trigger just turns a collision into a clearer message
-- for the common (non-race) case.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_display_name text := nullif(trim(new.raw_user_meta_data->>'display_name'), '');
begin
  if v_display_name is null then
    raise exception 'A display name is required.';
  end if;
  if char_length(v_display_name) > 60 then
    raise exception 'Display name must be 60 characters or fewer.';
  end if;
  begin
    insert into public.profiles (id, email, display_name) values (new.id, new.email, v_display_name);
  exception when unique_violation then
    raise exception 'That display name is already taken.';
  end;
  return new;
end;
$$;

create or replace function public.set_display_name(new_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := nullif(trim(new_name), '');
begin
  if v_name is not null and char_length(v_name) > 60 then
    raise exception 'display name too long';
  end if;
  begin
    update profiles set display_name = v_name where id = auth.uid();
  exception when unique_violation then
    raise exception 'That display name is already taken.';
  end;
end;
$$;

create or replace function public.moderator_set_display_name(target_id uuid, new_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_role text;
  target_role text;
begin
  select role into caller_role from profiles where id = auth.uid();
  if caller_role is null or role_level(caller_role) < 2 then
    raise exception 'not authorized';
  end if;
  select role into target_role from profiles where id = target_id;
  if target_role is null or role_level(target_role) >= role_level(caller_role) then
    raise exception 'cannot edit an account at or above your own level';
  end if;
  if new_name is not null and char_length(trim(new_name)) > 60 then
    raise exception 'display name too long';
  end if;
  begin
    update profiles set display_name = nullif(trim(new_name), '') where id = target_id;
  exception when unique_violation then
    raise exception 'That display name is already taken.';
  end;
  perform log_activity('display_name_changed_by_moderator', 'profile', target_id, null);
end;
$$;
