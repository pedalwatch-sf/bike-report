create index if not exists suggestions_status_submitted_id_idx
  on public.suggestions (status, submitted_at desc, id desc);

create index if not exists suggestions_user_submitted_id_idx
  on public.suggestions (user_id, submitted_at desc, id desc);

create index if not exists subscribers_suggestion_id_idx
  on public.subscribers (suggestion_id);

create or replace function public.get_report_page(
  p_statuses text[] default null,
  p_categories text[] default null,
  p_search text default null,
  p_user_id uuid default null,
  p_ids uuid[] default null,
  p_cursor_submitted_at timestamptz default null,
  p_cursor_id uuid default null,
  p_limit integer default 20
)
returns table (
  id uuid,
  title text,
  description text,
  category text,
  lat double precision,
  lng double precision,
  status text,
  submitted_at timestamptz,
  user_id uuid,
  subscriber_count bigint,
  report_images jsonb,
  total_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $function$
  with base as (
    select s.*
    from public.suggestions s
    where (p_statuses is null or cardinality(p_statuses) = 0 or s.status = any(p_statuses))
      and (p_categories is null or cardinality(p_categories) = 0 or s.category = any(p_categories))
      and (p_user_id is null or s.user_id = p_user_id)
      and (p_ids is null or cardinality(p_ids) = 0 or s.id = any(p_ids))
      and (
        nullif(btrim(p_search), '') is null
        or position(lower(btrim(p_search)) in lower(coalesce(s.title, ''))) > 0
        or position(lower(btrim(p_search)) in lower(coalesce(s.description, ''))) > 0
        or position(lower(btrim(p_search)) in lower(coalesce(s.category, ''))) > 0
      )
  ),
  page as (
    select b.*
    from base b
    where p_cursor_submitted_at is null
      or b.submitted_at < p_cursor_submitted_at
      or (
        b.submitted_at = p_cursor_submitted_at
        and p_cursor_id is not null
        and b.id < p_cursor_id
      )
    order by b.submitted_at desc, b.id desc
    limit least(greatest(coalesce(p_limit, 20), 1), 100)
  )
  select
    p.id,
    p.title,
    p.description,
    p.category,
    p.lat,
    p.lng,
    p.status,
    p.submitted_at,
    p.user_id,
    (
      select count(*)
      from public.subscribers sub
      where sub.suggestion_id = p.id
    ) as subscriber_count,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object('id', ri.id, 'url', ri.url)
          order by ri.created_at, ri.id
        )
        from public.report_images ri
        where ri.suggestion_id = p.id
      ),
      '[]'::jsonb
    ) as report_images,
    (select count(*) from base) as total_count
  from page p
  order by p.submitted_at desc, p.id desc;
$function$;

revoke all on function public.get_report_page(
  text[], text[], text, uuid, uuid[], timestamptz, uuid, integer
) from public;

grant execute on function public.get_report_page(
  text[], text[], text, uuid, uuid[], timestamptz, uuid, integer
) to anon, authenticated;
