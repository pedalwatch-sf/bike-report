-- Users can propose changes to active (approved) reports; moderators/admins review them.
create table public.change_suggestions (
  id uuid primary key default gen_random_uuid(),
  suggestion_id uuid not null references public.suggestions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  submitter_email text,
  message text not null,
  status text not null default 'pending' check (status in ('pending', 'reviewed')),
  created_at timestamptz not null default now()
);

create index change_suggestions_suggestion_id_idx on public.change_suggestions (suggestion_id);
create index change_suggestions_status_idx on public.change_suggestions (status);

alter table public.change_suggestions enable row level security;

create policy "signed-in users can propose changes to active reports"
on public.change_suggestions for insert
to authenticated
with check (
  auth.uid() = user_id
  and exists (select 1 from public.suggestions s where s.id = suggestion_id and s.status = 'approved')
);

create policy "moderators and admins can read change suggestions"
on public.change_suggestions for select
using (is_moderator_or_admin(auth.uid()));

create policy "moderators and admins can update change suggestions"
on public.change_suggestions for update
using (is_moderator_or_admin(auth.uid()));

grant select, insert, update on public.change_suggestions to authenticated;

-- Timeline entries should stay visible to everyone who can see the report,
-- but who posted each one should only be visible to moderators/admins.
create view public.timeline_updates
with (security_invoker = true) as
select
  id,
  suggestion_id,
  message,
  created_at,
  case when is_moderator_or_admin(auth.uid()) then created_by_email else null end as created_by_email
from public.updates;

grant select on public.timeline_updates to anon, authenticated;

-- Close the direct-table read path so the raw author email can't be read
-- by querying public.updates instead of the view.
revoke select (created_by_email) on public.updates from anon, authenticated;
grant select (id, suggestion_id, message, created_at) on public.updates to anon, authenticated;
