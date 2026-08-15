-- Per-account rate limits alone are easy to route around by creating
-- multiple accounts. Adds a per-IP limit on the same two write paths
-- (suggestions, change_suggestions), using PostgREST's pre-request hook.
-- The IP comes from X-Forwarded-For, which Supabase's edge proxy sets
-- itself based on the real connection -- not client-supplied, so it
-- can't be spoofed by just sending a fake header.
--
-- Also exempts the owner's own account from both the existing
-- per-account limits and this new per-IP one, so testing/using the app
-- normally never trips either.
create schema if not exists private;

create table private.rate_limits (
  ip inet not null,
  path text not null,
  request_at timestamptz not null default now()
);

create index rate_limits_ip_path_request_at_idx on private.rate_limits (ip, path, request_at desc);

create or replace function public.check_request()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  req_method text := current_setting('request.method', true);
  req_path text := current_setting('request.path', true);
  req_email text := current_setting('request.jwt.claims', true)::json->>'email';
  req_ip inet;
  count_in_window integer;
begin
  if req_method is distinct from 'POST' then
    return;
  end if;
  if req_path not in ('/suggestions', '/change_suggestions') then
    return;
  end if;
  if req_email = 'leungantoine@gmail.com' then
    return;
  end if;

  req_ip := split_part(
    coalesce(current_setting('request.headers', true)::json->>'x-forwarded-for', ''),
    ',', 1
  )::inet;

  select count(*) into count_in_window
  from private.rate_limits
  where ip = req_ip and path = req_path and request_at > now() - interval '1 hour';

  if count_in_window >= 20 then
    raise sqlstate 'PGRST' using
      message = json_build_object(
        'message', 'Too many submissions from this network recently -- please wait before submitting more.'
      )::text,
      detail = json_build_object('status', 429, 'status_text', 'Too Many Requests')::text;
  end if;

  insert into private.rate_limits (ip, path, request_at) values (req_ip, req_path, now());
end;
$$;

alter role authenticator set pgrst.db_pre_request = 'public.check_request';
notify pgrst, 'reload config';

create or replace function public.enforce_suggestion_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select email from auth.users where id = new.user_id) = 'leungantoine@gmail.com' then
    return new;
  end if;
  if (
    select count(*) from suggestions
    where user_id = new.user_id and submitted_at > now() - interval '1 hour'
  ) >= 10 then
    raise exception 'Too many reports submitted recently -- please wait before submitting more.';
  end if;
  return new;
end;
$$;

create or replace function public.enforce_change_suggestion_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select email from auth.users where id = new.user_id) = 'leungantoine@gmail.com' then
    return new;
  end if;
  if (
    select count(*) from change_suggestions
    where user_id = new.user_id and created_at > now() - interval '1 hour'
  ) >= 10 then
    raise exception 'Too many change suggestions submitted recently -- please wait before submitting more.';
  end if;
  return new;
end;
$$;
