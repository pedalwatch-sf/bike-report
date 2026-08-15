alter table public.profiles drop constraint profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('user', 'moderator', 'admin', 'owner'));

create or replace function public.role_level(r text)
returns int
language sql
immutable
set search_path = public
as $$
  select case r when 'owner' then 4 when 'admin' then 3 when 'moderator' then 2 else 1 end;
$$;

create or replace function public.is_admin(uid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from profiles where id = uid and role in ('admin', 'owner'));
$$;

create or replace function public.is_moderator_or_admin(uid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from profiles where id = uid and role in ('moderator', 'admin', 'owner'));
$$;

-- Previously hardcoded role = 'admin' directly instead of going through
-- is_admin(), which would have left 'owner' unable to review moderator
-- requests despite outranking admin everywhere else.
create or replace function public.admin_review_moderator_request(target_id uuid, approve boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin(auth.uid()) then
    raise exception 'not authorized';
  end if;
  if approve then
    update profiles set role = 'moderator', moderator_status = 'approved' where id = target_id;
  else
    update profiles set moderator_status = 'denied' where id = target_id;
  end if;
end;
$$;

-- Generalized to be relative to the caller's own level rather than a
-- hardcoded "admin" floor, so 'owner' can now also manage admin
-- accounts (which regular admins still can't touch, matching the same
-- "strictly lower" rule moderator_set_banned/moderator_set_display_name
-- already use). 'owner' itself is intentionally not a grantable value
-- here -- it's assigned directly, not through self-service promotion.
create or replace function public.admin_set_user_role(target_id uuid, new_role text)
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
  if caller_role is null or role_level(caller_role) < 3 then
    raise exception 'not authorized';
  end if;
  if new_role not in ('user', 'moderator', 'admin') then
    raise exception 'invalid role';
  end if;
  select role into target_role from profiles where id = target_id;
  if target_role is null or role_level(target_role) >= role_level(caller_role) then
    raise exception 'cannot change the role of an account at or above your own level';
  end if;
  update profiles
  set role = new_role,
      moderator_status = case
        when new_role = 'moderator' then 'approved'
        when new_role = 'admin' then moderator_status
        else 'none'
      end
  where id = target_id;
end;
$$;
