create or replace function public.admin_set_user_role(target_id uuid, new_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from profiles where id = auth.uid() and role = 'admin') then
    raise exception 'not authorized';
  end if;
  if new_role not in ('user', 'moderator', 'admin') then
    raise exception 'invalid role';
  end if;
  if target_id = auth.uid() and new_role <> 'admin' then
    raise exception 'cannot change your own role away from admin';
  end if;
  update profiles
  set role = new_role,
      moderator_status = case
        when new_role = 'moderator' then 'approved'
        when new_role = 'admin' then moderator_status
        else 'none'
      end
  where id = target_id;
end;
$$;

create policy "moderators and admins can delete suggestions"
on public.suggestions for delete
using (is_moderator_or_admin(auth.uid()));
