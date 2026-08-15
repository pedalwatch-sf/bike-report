-- Profile row for every signed-up user, tracking their role and any
-- moderator request status.
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text not null default 'user' check (role in ('user','moderator','admin')),
  moderator_status text not null default 'none' check (moderator_status in ('none','pending','approved','denied')),
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "users can view their own profile"
  on profiles for select
  using (auth.uid() = id);

-- Track who submitted each report.
alter table suggestions add column user_id uuid references auth.users(id);

-- Auto-create a profile row whenever someone signs up.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Helper functions used inside RLS policies (security definer so they can
-- read the profiles table regardless of the calling user's own RLS).
create or replace function is_moderator_or_admin(uid uuid)
returns boolean
language sql security definer set search_path = public
as $$
  select exists (select 1 from profiles where id = uid and role in ('moderator','admin'));
$$;

create or replace function is_admin(uid uuid)
returns boolean
language sql security definer set search_path = public
as $$
  select exists (select 1 from profiles where id = uid and role = 'admin');
$$;

-- Admins can see every profile (needed for the moderator-request review list).
create policy "admins can view all profiles"
  on profiles for select
  using (is_admin(auth.uid()));

-- A user can ask to become a moderator; this only ever touches their own row
-- and only moves none/denied -> pending, so it's safe to expose broadly.
create or replace function request_moderator_access()
returns void
language plpgsql security definer set search_path = public
as $$
begin
  update profiles
  set moderator_status = 'pending'
  where id = auth.uid() and moderator_status in ('none','denied');
end;
$$;
grant execute on function request_moderator_access() to authenticated;

-- Only an admin can approve or deny a moderator request.
create or replace function admin_review_moderator_request(target_id uuid, approve boolean)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not exists (select 1 from profiles where id = auth.uid() and role = 'admin') then
    raise exception 'not authorized';
  end if;
  if approve then
    update profiles set role = 'moderator', moderator_status = 'approved' where id = target_id;
  else
    update profiles set moderator_status = 'denied' where id = target_id;
  end if;
end;
$$;
grant execute on function admin_review_moderator_request(uuid, boolean) to authenticated;

-- Replace the old passcode-era suggestion policies with account-aware ones.
drop policy if exists "public can read approved suggestions" on suggestions;
drop policy if exists "anyone can submit a suggestion" on suggestions;

create policy "read approved, own, or as moderator"
  on suggestions for select
  using (
    status = 'approved'
    or auth.uid() = user_id
    or is_moderator_or_admin(auth.uid())
  );

create policy "signed-in users can submit their own suggestion"
  on suggestions for insert
  to authenticated
  with check (status = 'pending' and auth.uid() = user_id);

create policy "moderators and admins can update suggestions"
  on suggestions for update
  using (is_moderator_or_admin(auth.uid()));
