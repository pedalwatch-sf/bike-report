
-- Users who've enrolled and verified a TOTP factor must be at aal2 (i.e.
-- have completed the MFA challenge this session) for any authenticated-role
-- table access. Users who haven't enrolled are unaffected (aal1 still
-- passes). Public/anon access is untouched -- these are `to authenticated`
-- only, and `as restrictive` means they layer on top of every existing
-- permissive policy without needing to touch any of them.
create policy "require aal2 if mfa enrolled" on public.suggestions
  as restrictive to authenticated using (
    array[(select auth.jwt()->>'aal')] <@ (
      select case when count(id) > 0 then array['aal2'] else array['aal1','aal2'] end
      from auth.mfa_factors
      where (select auth.uid()) = user_id and status = 'verified'
    )
  );

create policy "require aal2 if mfa enrolled" on public.report_images
  as restrictive to authenticated using (
    array[(select auth.jwt()->>'aal')] <@ (
      select case when count(id) > 0 then array['aal2'] else array['aal1','aal2'] end
      from auth.mfa_factors
      where (select auth.uid()) = user_id and status = 'verified'
    )
  );

create policy "require aal2 if mfa enrolled" on public.updates
  as restrictive to authenticated using (
    array[(select auth.jwt()->>'aal')] <@ (
      select case when count(id) > 0 then array['aal2'] else array['aal1','aal2'] end
      from auth.mfa_factors
      where (select auth.uid()) = user_id and status = 'verified'
    )
  );

create policy "require aal2 if mfa enrolled" on public.change_suggestions
  as restrictive to authenticated using (
    array[(select auth.jwt()->>'aal')] <@ (
      select case when count(id) > 0 then array['aal2'] else array['aal1','aal2'] end
      from auth.mfa_factors
      where (select auth.uid()) = user_id and status = 'verified'
    )
  );

create policy "require aal2 if mfa enrolled" on public.profiles
  as restrictive to authenticated using (
    array[(select auth.jwt()->>'aal')] <@ (
      select case when count(id) > 0 then array['aal2'] else array['aal1','aal2'] end
      from auth.mfa_factors
      where (select auth.uid()) = user_id and status = 'verified'
    )
  );

create policy "require aal2 if mfa enrolled" on public.subscribers
  as restrictive to authenticated using (
    array[(select auth.jwt()->>'aal')] <@ (
      select case when count(id) > 0 then array['aal2'] else array['aal1','aal2'] end
      from auth.mfa_factors
      where (select auth.uid()) = user_id and status = 'verified'
    )
  );

create policy "require aal2 if mfa enrolled" on public.subscriber_identities
  as restrictive to authenticated using (
    array[(select auth.jwt()->>'aal')] <@ (
      select case when count(id) > 0 then array['aal2'] else array['aal1','aal2'] end
      from auth.mfa_factors
      where (select auth.uid()) = user_id and status = 'verified'
    )
  );
