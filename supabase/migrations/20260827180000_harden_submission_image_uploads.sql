-- Store each user's uploads in a dedicated folder and meter uploads at the
-- Storage boundary. Table-level report limits do not protect this endpoint:
-- clients can otherwise call the Storage API without creating a report.
create table if not exists private.image_upload_rate_limits (
  user_id uuid not null references auth.users(id) on delete cascade,
  request_at timestamptz not null default now()
);

create index if not exists image_upload_rate_limits_user_request_at_idx
  on private.image_upload_rate_limits (user_id, request_at desc);

create or replace function public.consume_submission_image_upload_quota(object_name text)
returns boolean
language plpgsql
security definer
set search_path = public, private
as $$
declare
  request_user_id uuid := auth.uid();
  uploads_in_window integer;
begin
  if request_user_id is null
     or is_banned(request_user_id)
     or (storage.foldername(object_name))[1] is distinct from request_user_id::text then
    return false;
  end if;

  -- Serialize quota checks for one account so concurrent uploads cannot pass
  -- the count check together.
  perform pg_advisory_xact_lock(hashtextextended(request_user_id::text, 0));

  select count(*) into uploads_in_window
  from private.image_upload_rate_limits
  where user_id = request_user_id
    and request_at > now() - interval '1 hour';

  if uploads_in_window >= 20 then
    raise exception 'Too many image uploads recently -- please wait before trying again.';
  end if;

  insert into private.image_upload_rate_limits (user_id) values (request_user_id);
  return true;
end;
$$;

revoke all on function public.consume_submission_image_upload_quota(text) from public, anon, authenticated;
grant execute on function public.consume_submission_image_upload_quota(text) to authenticated;

drop policy "signed-in non-banned users can upload submission images" on storage.objects;

create policy "metered user-folder uploads for submission images"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'submission-images'
  and public.consume_submission_image_upload_quota(name)
);

-- The detail page accepts change suggestions for resolved reports; use the
-- same set in RLS so the visible workflow is not rejected on submit.
drop policy "signed-in users can propose changes to active reports" on public.change_suggestions;

create policy "signed-in users can propose changes to active reports"
on public.change_suggestions for insert
to authenticated
with check (
  auth.uid() = user_id
  and not is_banned(auth.uid())
  and exists (
    select 1
    from public.suggestions s
    where s.id = suggestion_id
      and s.status in ('approved', 'resolved')
  )
);
