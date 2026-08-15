-- Role hierarchy: user < moderator < admin.
create or replace function public.role_level(r text)
returns int
language sql
immutable
set search_path = public
as $$
  select case r when 'admin' then 3 when 'moderator' then 2 else 1 end;
$$;

alter table public.profiles add column banned boolean not null default false;

create or replace function public.is_banned(uid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((select banned from profiles where id = uid), false);
$$;

-- Moderators need to see the accounts they're now allowed to manage.
-- Scoped to role = 'user' only, so a moderator never sees other
-- moderators'/admins' emails -- admins already see everyone via the
-- existing "admins can view all profiles" policy.
create policy "moderators can view user-level profiles"
on public.profiles for select
using (is_moderator_or_admin(auth.uid()) and role = 'user');

-- Moderators and admins can edit/ban accounts strictly below their own
-- level. Deliberately narrow: only display_name and banned, never role
-- (role changes stay admin-only via admin_set_user_role) -- avoids a
-- general self/other UPDATE policy, which the table's broad legacy
-- grants would otherwise turn into a privilege-escalation path.
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
  update profiles set display_name = nullif(trim(new_name), '') where id = target_id;
end;
$$;

grant execute on function public.moderator_set_display_name(uuid, text) to authenticated;

create or replace function public.moderator_set_banned(target_id uuid, new_banned boolean)
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
  update profiles set banned = new_banned where id = target_id;
end;
$$;

grant execute on function public.moderator_set_banned(uuid, boolean) to authenticated;

-- Tighten admin_set_user_role to the same hierarchy rule (previously it
-- only blocked self-demotion, but let any admin change any other
-- admin's role -- now no admin can touch another admin account at all).
create or replace function public.admin_set_user_role(target_id uuid, new_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_role text;
begin
  if not is_admin(auth.uid()) then
    raise exception 'not authorized';
  end if;
  if new_role not in ('user', 'moderator', 'admin') then
    raise exception 'invalid role';
  end if;
  select role into target_role from profiles where id = target_id;
  if target_role is null or role_level(target_role) >= 3 then
    raise exception 'cannot change the role of an admin account';
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

-- Banned accounts can't create new reports or suggest changes.
drop policy "signed-in users can submit their own suggestion" on public.suggestions;
create policy "signed-in users can submit their own suggestion"
on public.suggestions for insert
to authenticated
with check (status = 'pending' and auth.uid() = user_id and not is_banned(auth.uid()));

drop policy "signed-in users can propose changes to active reports" on public.change_suggestions;
create policy "signed-in users can propose changes to active reports"
on public.change_suggestions for insert
to authenticated
with check (
  auth.uid() = user_id
  and not is_banned(auth.uid())
  and exists (select 1 from public.suggestions s where s.id = suggestion_id and s.status = 'approved')
);
