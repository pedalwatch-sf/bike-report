-- Two fixes to the PostgREST pre-request hook. Behavior is otherwise
-- identical -- same MFA rule, same 20/hour per-IP limit, same owner exemption.
--
-- 1. A missing X-Forwarded-For crashed every submission. The IP was parsed as
--    `split_part(coalesce(header, ''), ',', 1)::inet`, and ''::inet raises
--    22P02 rather than returning null. Since this runs as the pre-request
--    hook, that exception surfaced as a 500 on every POST to /suggestions and
--    /change_suggestions -- the whole submit flow, not just the rate limiter.
--    Supabase's edge proxy always sets the header today, so this never fired
--    in production, but it made the core write path depend on that always
--    being true. Now the parse is wrapped: an absent, blank, or malformed
--    header yields null and the per-IP check is skipped, leaving the
--    per-account limit (10/hour) and the sign-in CAPTCHA still enforced.
--
-- 2. The MFA gate ran its auth.mfa_factors lookup before checking the JWT's
--    own aal claim, so every authenticated request paid for the query even
--    when the session was already aal2. Postgres does not guarantee AND
--    short-circuit order, so the cheap claim check now gates the lookup via a
--    nested IF. The gate deliberately still applies to every authenticated
--    request, not just writes -- SECURITY DEFINER RPCs bypass table RLS, so
--    this hook is the only place aal2 can be enforced for them.
create or replace function public.check_request()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  req_method text := current_setting('request.method', true);
  req_path text := current_setting('request.path', true);
  req_claims json := current_setting('request.jwt.claims', true)::json;
  req_sub uuid := nullif(req_claims->>'sub', '')::uuid;
  req_aal text := req_claims->>'aal';
  req_ip inet;
  count_in_window integer;
begin
  if req_sub is not null and req_aal is distinct from 'aal2' then
    if public.user_has_verified_mfa(req_sub) then
      raise sqlstate 'PGRST' using
        message = json_build_object(
          'code', 'mfa_required',
          'message', 'Multi-factor authentication is required for this account.'
        )::text,
        detail = json_build_object('status', 403, 'status_text', 'Forbidden')::text;
    end if;
  end if;

  if req_method is distinct from 'POST' then
    return;
  end if;
  if req_path not in ('/suggestions', '/change_suggestions') then
    return;
  end if;
  if req_sub is not null and is_owner(req_sub) then
    return;
  end if;

  begin
    req_ip := nullif(
      trim(split_part(
        coalesce(current_setting('request.headers', true)::json->>'x-forwarded-for', ''),
        ',', 1
      )),
      ''
    )::inet;
  exception when others then
    req_ip := null;
  end;

  if req_ip is null then
    return;
  end if;

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

revoke all on function public.check_request() from public;
grant execute on function public.check_request() to anon, authenticated, service_role;

notify pgrst, 'reload schema';
