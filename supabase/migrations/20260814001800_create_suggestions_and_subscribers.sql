create table suggestions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  category text not null,
  lat float8,
  lng float8,
  status text not null default 'pending',
  image_url text,
  submitted_at timestamptz not null default now()
);

create table subscribers (
  id uuid primary key default gen_random_uuid(),
  suggestion_id uuid references suggestions(id) on delete cascade,
  email text,
  added_at timestamptz not null default now()
);

alter table suggestions enable row level security;
alter table subscribers enable row level security;

create policy "public can read approved suggestions"
  on suggestions for select
  using (status = 'approved');

create policy "anyone can submit a suggestion"
  on suggestions for insert
  with check (status = 'pending');

create policy "anyone can register interest"
  on subscribers for insert
  with check (true);
