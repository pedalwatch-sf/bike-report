-- Replace the hardcoded-email exemption with a role check, matching how
-- every other privileged check in this app works (relative to role, not
-- tied to one person's identity) -- if the owner role is ever handed to a
-- different account, the exemption follows it automatically.
create or replace function public.is_owner(uid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from profiles where id = uid and role = 'owner');
$$;

create or replace function public.check_request()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  req_method text := current_setting('request.method', true);
  req_path text := current_setting('request.path', true);
  req_sub uuid := nullif(current_setting('request.jwt.claims', true)::json->>'sub', '')::uuid;
  req_ip inet;
  count_in_window integer;
begin
  if req_method is distinct from 'POST' then
    return;
  end if;
  if req_path not in ('/suggestions', '/change_suggestions') then
    return;
  end if;
  if req_sub is not null and is_owner(req_sub) then
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

create or replace function public.enforce_suggestion_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if is_owner(new.user_id) then
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
  if is_owner(new.user_id) then
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
