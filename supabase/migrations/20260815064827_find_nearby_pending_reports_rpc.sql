
-- Regular RLS only lets a user see their own pending reports, so two
-- different people submitting near-simultaneous reports for the same
-- spot never see each other's still-pending submission via a normal
-- query. This exposes just enough (id, title) for a same-category,
-- same-radius duplicate warning, without exposing full pending report
-- details more broadly than needed.
create or replace function public.find_nearby_pending_reports(
  p_lat float8, p_lng float8, p_category text, p_radius_meters float8 default 75
)
returns table(id uuid, title text)
language sql
stable
security definer
set search_path to 'public'
as $$
  select s.id, s.title
  from suggestions s
  where s.status = 'pending'
    and s.category = p_category
    and s.lat is not null and s.lng is not null
    and 2 * 6371000 * asin(sqrt(
      power(sin(radians(s.lat - p_lat) / 2), 2) +
      cos(radians(p_lat)) * cos(radians(s.lat)) * power(sin(radians(s.lng - p_lng) / 2), 2)
    )) <= p_radius_meters;
$$;

revoke all on function public.find_nearby_pending_reports(float8, float8, text, float8) from public;
grant execute on function public.find_nearby_pending_reports(float8, float8, text, float8) to authenticated;
