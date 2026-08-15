create table updates (
  id uuid primary key default gen_random_uuid(),
  suggestion_id uuid not null references suggestions(id) on delete cascade,
  message text not null,
  created_by_email text,
  created_at timestamptz not null default now()
);

alter table updates enable row level security;

create policy "read updates for visible reports"
  on updates for select
  using (
    exists (
      select 1 from suggestions s
      where s.id = updates.suggestion_id
        and (s.status = 'approved' or s.user_id = auth.uid() or is_moderator_or_admin(auth.uid()))
    )
  );

create policy "moderators and admins can post updates"
  on updates for insert
  to authenticated
  with check (is_moderator_or_admin(auth.uid()));
