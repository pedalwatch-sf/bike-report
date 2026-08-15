alter table public.suggestions drop constraint suggestions_status_check;
alter table public.suggestions add constraint suggestions_status_check
  check (status = any (array['pending', 'approved', 'rejected', 'resolved', 'withdrawn']));

create or replace function public.withdraw_own_report(target_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  update suggestions
  set status = 'withdrawn'
  where id = target_id
    and user_id = auth.uid()
    and status <> 'withdrawn';

  if not found then
    raise exception 'report not found or not yours to withdraw';
  end if;
end;
$$;

revoke all on function public.withdraw_own_report(uuid) from public;
grant execute on function public.withdraw_own_report(uuid) to authenticated;
