-- Security-definer functions inherit broad Supabase default EXECUTE grants
-- unless they are explicitly narrowed. Keep API-facing RPCs least-privilege,
-- and make trigger/audit helpers unreachable through /rest/v1/rpc.

alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;

-- Enforce verified MFA before every authenticated Data API request, including
-- security-definer RPCs that do not pass through table RLS policies.
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
  if req_sub is not null
     and public.user_has_verified_mfa(req_sub)
     and req_aal is distinct from 'aal2' then
    raise sqlstate 'PGRST' using
      message = json_build_object(
        'code', 'mfa_required',
        'message', 'Multi-factor authentication is required for this account.'
      )::text,
      detail = json_build_object('status', 403, 'status_text', 'Forbidden')::text;
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

revoke all on function public.check_request() from public;
grant execute on function public.check_request() to anon, authenticated, service_role;

-- Only reveal MFA enrollment for the current authenticated user. This remains
-- callable by authenticated because restrictive RLS policies also use it.
create or replace function public.user_has_verified_mfa(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select uid is not null
    and uid = auth.uid()
    and exists (
      select 1 from auth.mfa_factors
      where user_id = uid and status = 'verified'
    );
$$;

revoke all on function public.user_has_verified_mfa(uuid) from public, anon;
grant execute on function public.user_has_verified_mfa(uuid) to authenticated;

-- Internal trigger and audit helpers must never be directly executable by an
-- API role. Their owning functions/triggers continue to invoke them normally.
revoke all on function public.enforce_change_suggestion_rate_limit() from public, anon, authenticated;
revoke all on function public.enforce_suggestion_rate_limit() from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.log_activity(text, text, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.log_change_suggestion_insert() from public, anon, authenticated;
revoke all on function public.log_change_suggestion_update() from public, anon, authenticated;
revoke all on function public.log_report_image_delete() from public, anon, authenticated;
revoke all on function public.log_report_image_insert() from public, anon, authenticated;
revoke all on function public.log_suggestion_delete() from public, anon, authenticated;
revoke all on function public.log_suggestion_insert() from public, anon, authenticated;
revoke all on function public.log_suggestion_update() from public, anon, authenticated;
revoke all on function public.log_update_delete() from public, anon, authenticated;
revoke all on function public.log_update_insert() from public, anon, authenticated;
revoke all on function public.log_update_update() from public, anon, authenticated;

-- Signed-in RPCs: remove anonymous access while preserving authenticated use.
revoke all on function public.admin_review_moderator_request(uuid, boolean) from public, anon;
revoke all on function public.admin_set_user_role(uuid, text) from public, anon;
revoke all on function public.get_activity_log() from public, anon;
revoke all on function public.get_all_timeline_updates_for_moderation() from public, anon;
revoke all on function public.get_moderation_pending_count() from public, anon;
revoke all on function public.get_my_subscriptions() from public, anon;
revoke all on function public.get_report_subscribers(uuid) from public, anon;
revoke all on function public.get_user_activity_log(uuid) from public, anon;
revoke all on function public.get_users_for_moderation() from public, anon;
revoke all on function public.mark_subscription_seen(uuid) from public, anon;
revoke all on function public.moderator_set_banned(uuid, boolean) from public, anon;
revoke all on function public.moderator_set_display_name(uuid, text) from public, anon;
revoke all on function public.register_interest(uuid) from public, anon;
revoke all on function public.request_moderator_access() from public, anon;
revoke all on function public.set_display_name(text) from public, anon;
revoke all on function public.unregister_interest(uuid) from public, anon;
revoke all on function public.withdraw_own_report(uuid) from public, anon;

grant execute on function public.admin_review_moderator_request(uuid, boolean) to authenticated;
grant execute on function public.admin_set_user_role(uuid, text) to authenticated;
grant execute on function public.get_activity_log() to authenticated;
grant execute on function public.get_all_timeline_updates_for_moderation() to authenticated;
grant execute on function public.get_moderation_pending_count() to authenticated;
grant execute on function public.get_my_subscriptions() to authenticated;
grant execute on function public.get_report_subscribers(uuid) to authenticated;
grant execute on function public.get_user_activity_log(uuid) to authenticated;
grant execute on function public.get_users_for_moderation() to authenticated;
grant execute on function public.mark_subscription_seen(uuid) to authenticated;
grant execute on function public.moderator_set_banned(uuid, boolean) to authenticated;
grant execute on function public.moderator_set_display_name(uuid, text) to authenticated;
grant execute on function public.register_interest(uuid) to authenticated;
grant execute on function public.request_moderator_access() to authenticated;
grant execute on function public.set_display_name(text) to authenticated;
grant execute on function public.unregister_interest(uuid) to authenticated;
grant execute on function public.withdraw_own_report(uuid) to authenticated;

-- Deliberately public, read-only RPCs used before sign-in or on public pages.
revoke all on function public.get_public_profile(uuid) from public;
revoke all on function public.get_public_profiles(uuid[]) from public;
revoke all on function public.get_public_stats() from public;
revoke all on function public.get_timeline_updates(uuid) from public;
revoke all on function public.is_display_name_taken(text) from public;

grant execute on function public.get_public_profile(uuid) to anon, authenticated;
grant execute on function public.get_public_profiles(uuid[]) to anon, authenticated;
grant execute on function public.get_public_stats() to anon, authenticated;
grant execute on function public.get_timeline_updates(uuid) to anon, authenticated;
grant execute on function public.is_display_name_taken(text) to anon, authenticated;

notify pgrst, 'reload schema';
