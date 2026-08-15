
-- Avoids granting any access to auth.mfa_factors (which holds TOTP secrets
-- and phone numbers) to the authenticated role -- this function runs with
-- the owner's privilege and only ever returns a boolean.
create or replace function public.user_has_verified_mfa(uid uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from auth.mfa_factors
    where user_id = uid and status = 'verified'
  );
$$;

revoke all on function public.user_has_verified_mfa(uuid) from public;
grant execute on function public.user_has_verified_mfa(uuid) to authenticated;

create policy "require aal2 if mfa enrolled" on public.suggestions
  as restrictive to authenticated using (
    not public.user_has_verified_mfa(auth.uid()) or (select auth.jwt()->>'aal') = 'aal2'
  );

create policy "require aal2 if mfa enrolled" on public.report_images
  as restrictive to authenticated using (
    not public.user_has_verified_mfa(auth.uid()) or (select auth.jwt()->>'aal') = 'aal2'
  );

create policy "require aal2 if mfa enrolled" on public.updates
  as restrictive to authenticated using (
    not public.user_has_verified_mfa(auth.uid()) or (select auth.jwt()->>'aal') = 'aal2'
  );

create policy "require aal2 if mfa enrolled" on public.change_suggestions
  as restrictive to authenticated using (
    not public.user_has_verified_mfa(auth.uid()) or (select auth.jwt()->>'aal') = 'aal2'
  );

create policy "require aal2 if mfa enrolled" on public.profiles
  as restrictive to authenticated using (
    not public.user_has_verified_mfa(auth.uid()) or (select auth.jwt()->>'aal') = 'aal2'
  );

create policy "require aal2 if mfa enrolled" on public.subscribers
  as restrictive to authenticated using (
    not public.user_has_verified_mfa(auth.uid()) or (select auth.jwt()->>'aal') = 'aal2'
  );

create policy "require aal2 if mfa enrolled" on public.subscriber_identities
  as restrictive to authenticated using (
    not public.user_has_verified_mfa(auth.uid()) or (select auth.jwt()->>'aal') = 'aal2'
  );
