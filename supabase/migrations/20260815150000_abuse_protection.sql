-- Storage: uploads to submission-images were open to literally anyone,
-- signed in or not, with no file size or type limit -- a free target for
-- abuse (storage cost, hosting arbitrary content) that never matched how
-- the app itself actually uses this bucket (only signed-in, non-banned
-- users ever call uploadImage(), from Submit, Suggest a change, or
-- Moderate).
drop policy "anyone can upload submission images" on storage.objects;

create policy "signed-in non-banned users can upload submission images"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'submission-images'
  and not is_banned(auth.uid())
);

update storage.buckets
set file_size_limit = 10485760, -- 10MB
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
where id = 'submission-images';

-- Rate-limit report submissions and change suggestions per account, to
-- blunt scripted spam. Generous enough that a real person reporting
-- several genuine issues in a session never notices it.
create or replace function public.enforce_suggestion_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (
    select count(*) from suggestions
    where user_id = new.user_id and submitted_at > now() - interval '1 hour'
  ) >= 10 then
    raise exception 'Too many reports submitted recently -- please wait before submitting more.';
  end if;
  return new;
end;
$$;

create trigger trg_enforce_suggestion_rate_limit
before insert on public.suggestions
for each row execute function public.enforce_suggestion_rate_limit();

create or replace function public.enforce_change_suggestion_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (
    select count(*) from change_suggestions
    where user_id = new.user_id and created_at > now() - interval '1 hour'
  ) >= 10 then
    raise exception 'Too many change suggestions submitted recently -- please wait before submitting more.';
  end if;
  return new;
end;
$$;

create trigger trg_enforce_change_suggestion_rate_limit
before insert on public.change_suggestions
for each row execute function public.enforce_change_suggestion_rate_limit();
