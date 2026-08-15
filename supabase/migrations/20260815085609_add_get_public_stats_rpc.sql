-- Aggregate-only counts for a public impact page. Bypasses RLS via
-- security definer since anon/authenticated can normally only see
-- approved/resolved rows, but this returns counts, never row content,
-- so there's nothing sensitive to gate behind an authorization check.
create or replace function public.get_public_stats()
returns table (
  total_submitted bigint,
  active bigint,
  resolved bigint,
  in_review bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    count(*) as total_submitted,
    count(*) filter (where status = 'approved') as active,
    count(*) filter (where status = 'resolved') as resolved,
    count(*) filter (where status = 'pending') as in_review
  from suggestions;
$$;

grant execute on function public.get_public_stats() to anon, authenticated;
