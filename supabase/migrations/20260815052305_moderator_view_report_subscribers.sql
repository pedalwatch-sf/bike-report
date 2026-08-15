create or replace function public.get_report_subscribers(target_suggestion_id uuid)
returns table(email text, added_at timestamptz)
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not is_moderator_or_admin(auth.uid()) then
    raise exception 'not authorized';
  end if;

  return query
    select coalesce(u.email, s.email)::text, s.added_at
    from subscribers s
    left join auth.users u on u.id = s.user_id
    where s.suggestion_id = target_suggestion_id
    order by s.added_at asc;
end;
$$;

revoke all on function public.get_report_subscribers(uuid) from public;
grant execute on function public.get_report_subscribers(uuid) to authenticated;
