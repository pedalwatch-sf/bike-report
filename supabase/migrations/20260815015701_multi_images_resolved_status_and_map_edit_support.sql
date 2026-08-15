-- Multiple images per report, replacing the single image_url column.
create table public.report_images (
  id uuid primary key default gen_random_uuid(),
  suggestion_id uuid not null references public.suggestions(id) on delete cascade,
  url text not null,
  created_at timestamptz not null default now()
);

create index report_images_suggestion_id_idx on public.report_images (suggestion_id);

alter table public.report_images enable row level security;

create policy "read images for visible reports"
on public.report_images for select
using (
  exists (
    select 1 from suggestions s
    where s.id = suggestion_id
      and (s.status in ('approved', 'resolved') or s.user_id = auth.uid() or is_moderator_or_admin(auth.uid()))
  )
);

create policy "submitters can add images while pending, moderators anytime"
on public.report_images for insert
to authenticated
with check (
  is_moderator_or_admin(auth.uid())
  or exists (
    select 1 from suggestions s
    where s.id = suggestion_id and s.status = 'pending' and s.user_id = auth.uid()
  )
);

create policy "moderators and admins can remove images"
on public.report_images for delete
using (is_moderator_or_admin(auth.uid()));

grant select, insert on public.report_images to anon, authenticated;
grant delete on public.report_images to authenticated;

-- Migrate existing single images, then retire the old column.
insert into public.report_images (suggestion_id, url)
select id, image_url from public.suggestions where image_url is not null;

alter table public.suggestions drop column image_url;

-- Resolved is a new terminal status alongside approved/rejected/pending.
alter table public.suggestions add constraint suggestions_status_check
  check (status in ('pending', 'approved', 'rejected', 'resolved'));

drop policy "read approved, own, or as moderator" on public.suggestions;
create policy "read approved, own, or as moderator"
on public.suggestions for select
using (
  status in ('approved', 'resolved') or auth.uid() = user_id or is_moderator_or_admin(auth.uid())
);

-- Users can suggest attaching images along with a change suggestion.
alter table public.change_suggestions add column image_urls text[];
