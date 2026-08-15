-- Full audit trail of suggestion and moderation activity, visible to
-- moderators and above. Lives in the private schema (already used for
-- rate_limits) so it's unreachable via the Data API regardless of grants
-- -- all writes go through log_activity(), called from triggers and the
-- existing account-management RPCs; all reads go through
-- get_activity_log(), which resolves the actor's email/display name
-- regardless of the caller's normal profile-visibility restrictions,
-- since the point is showing which staff member did what. Only covers
-- activity from here on -- past actions were never recorded.
create schema if not exists private;

create table private.activity_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id),
  action text not null,
  target_type text not null,
  target_id uuid,
  detail jsonb,
  created_at timestamptz not null default now()
);

create index activity_log_created_at_idx on private.activity_log (created_at desc);

create or replace function public.log_activity(
  p_action text, p_target_type text, p_target_id uuid, p_detail jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into private.activity_log (actor_id, action, target_type, target_id, detail)
  values (auth.uid(), p_action, p_target_type, p_target_id, p_detail);
end;
$$;

create or replace function public.get_activity_log()
returns table (
  id uuid,
  actor_email text,
  actor_display_name text,
  action text,
  target_type text,
  target_id uuid,
  detail jsonb,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_moderator_or_admin(auth.uid()) then
    raise exception 'not authorized';
  end if;

  return query
    select l.id, u.email::text, p.display_name, l.action, l.target_type, l.target_id, l.detail, l.created_at
    from private.activity_log l
    left join auth.users u on u.id = l.actor_id
    left join profiles p on p.id = l.actor_id
    order by l.created_at desc
    limit 300;
end;
$$;

revoke all on function public.get_activity_log() from public;
grant execute on function public.get_activity_log() to authenticated;

-- suggestions: submitted, status changed (approve/reject/resolve/reopen/
-- withdraw), other fields edited, deleted
create or replace function public.log_suggestion_insert()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  perform log_activity('report_submitted', 'suggestion', new.id, jsonb_build_object('title', new.title, 'category', new.category));
  return new;
end;
$$;
create trigger trg_log_suggestion_insert after insert on public.suggestions for each row execute function public.log_suggestion_insert();

create or replace function public.log_suggestion_update()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if old.status is distinct from new.status then
    perform log_activity('report_status_changed', 'suggestion', new.id, jsonb_build_object('title', new.title, 'from', old.status, 'to', new.status));
  end if;
  if old.title is distinct from new.title or old.description is distinct from new.description
     or old.category is distinct from new.category or old.lat is distinct from new.lat or old.lng is distinct from new.lng then
    perform log_activity('report_edited', 'suggestion', new.id, jsonb_build_object('title', new.title));
  end if;
  return new;
end;
$$;
create trigger trg_log_suggestion_update after update on public.suggestions for each row execute function public.log_suggestion_update();

create or replace function public.log_suggestion_delete()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  perform log_activity('report_deleted', 'suggestion', old.id, jsonb_build_object('title', old.title));
  return old;
end;
$$;
create trigger trg_log_suggestion_delete after delete on public.suggestions for each row execute function public.log_suggestion_delete();

-- change_suggestions: submitted, reviewed
create or replace function public.log_change_suggestion_insert()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  perform log_activity('change_suggestion_submitted', 'change_suggestion', new.id, jsonb_build_object('suggestion_id', new.suggestion_id));
  return new;
end;
$$;
create trigger trg_log_change_suggestion_insert after insert on public.change_suggestions for each row execute function public.log_change_suggestion_insert();

create or replace function public.log_change_suggestion_update()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if old.status is distinct from new.status then
    perform log_activity('change_suggestion_reviewed', 'change_suggestion', new.id, jsonb_build_object('suggestion_id', new.suggestion_id));
  end if;
  return new;
end;
$$;
create trigger trg_log_change_suggestion_update after update on public.change_suggestions for each row execute function public.log_change_suggestion_update();

-- updates (progress timeline): posted, edited, deleted
create or replace function public.log_update_insert()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  perform log_activity('timeline_event_posted', 'suggestion', new.suggestion_id, jsonb_build_object('update_id', new.id, 'message', new.message));
  return new;
end;
$$;
create trigger trg_log_update_insert after insert on public.updates for each row execute function public.log_update_insert();

create or replace function public.log_update_update()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if old.message is distinct from new.message then
    perform log_activity('timeline_event_edited', 'suggestion', new.suggestion_id, jsonb_build_object('update_id', new.id));
  end if;
  return new;
end;
$$;
create trigger trg_log_update_update after update on public.updates for each row execute function public.log_update_update();

create or replace function public.log_update_delete()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  perform log_activity('timeline_event_deleted', 'suggestion', old.suggestion_id, jsonb_build_object('update_id', old.id));
  return old;
end;
$$;
create trigger trg_log_update_delete after delete on public.updates for each row execute function public.log_update_delete();

-- report_images: added, removed
create or replace function public.log_report_image_insert()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  perform log_activity('report_image_added', 'suggestion', new.suggestion_id, jsonb_build_object('image_id', new.id));
  return new;
end;
$$;
create trigger trg_log_report_image_insert after insert on public.report_images for each row execute function public.log_report_image_insert();

create or replace function public.log_report_image_delete()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  perform log_activity('report_image_removed', 'suggestion', old.suggestion_id, jsonb_build_object('image_id', old.id));
  return old;
end;
$$;
create trigger trg_log_report_image_delete after delete on public.report_images for each row execute function public.log_report_image_delete();

-- Account-management RPCs: log inline instead of via trigger. Each
-- function body below is otherwise unchanged from its current
-- definition -- only the trailing log_activity call is new.

create or replace function public.moderator_set_banned(target_id uuid, new_banned boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_role text;
  target_role text;
begin
  select role into caller_role from profiles where id = auth.uid();
  if caller_role is null or role_level(caller_role) < 2 then
    raise exception 'not authorized';
  end if;
  select role into target_role from profiles where id = target_id;
  if target_role is null or role_level(target_role) >= role_level(caller_role) then
    raise exception 'cannot edit an account at or above your own level';
  end if;
  update profiles set banned = new_banned where id = target_id;
  perform log_activity(case when new_banned then 'user_banned' else 'user_unbanned' end, 'profile', target_id, null);
end;
$$;

create or replace function public.admin_set_user_role(target_id uuid, new_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_role text;
  target_role text;
begin
  select role into caller_role from profiles where id = auth.uid();
  if caller_role is null or role_level(caller_role) < 3 then
    raise exception 'not authorized';
  end if;
  if new_role not in ('user', 'moderator', 'admin') then
    raise exception 'invalid role';
  end if;
  select role into target_role from profiles where id = target_id;
  if target_role is null or role_level(target_role) >= role_level(caller_role) then
    raise exception 'cannot change the role of an account at or above your own level';
  end if;
  update profiles
  set role = new_role,
      moderator_status = case
        when new_role = 'moderator' then 'approved'
        when new_role = 'admin' then moderator_status
        else 'none'
      end
  where id = target_id;
  perform log_activity('role_changed', 'profile', target_id, jsonb_build_object('from', target_role, 'to', new_role));
end;
$$;

create or replace function public.admin_review_moderator_request(target_id uuid, approve boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin(auth.uid()) then
    raise exception 'not authorized';
  end if;
  if approve then
    update profiles set role = 'moderator', moderator_status = 'approved' where id = target_id;
  else
    update profiles set moderator_status = 'denied' where id = target_id;
  end if;
  perform log_activity(case when approve then 'moderator_request_approved' else 'moderator_request_denied' end, 'profile', target_id, null);
end;
$$;

create or replace function public.moderator_set_display_name(target_id uuid, new_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_role text;
  target_role text;
begin
  select role into caller_role from profiles where id = auth.uid();
  if caller_role is null or role_level(caller_role) < 2 then
    raise exception 'not authorized';
  end if;
  select role into target_role from profiles where id = target_id;
  if target_role is null or role_level(target_role) >= role_level(caller_role) then
    raise exception 'cannot edit an account at or above your own level';
  end if;
  if new_name is not null and char_length(trim(new_name)) > 60 then
    raise exception 'display name too long';
  end if;
  update profiles set display_name = nullif(trim(new_name), '') where id = target_id;
  perform log_activity('display_name_changed_by_moderator', 'profile', target_id, null);
end;
$$;

create or replace function public.request_moderator_access()
returns void
language plpgsql security definer set search_path = public
as $$
begin
  update profiles
  set moderator_status = 'pending'
  where id = auth.uid() and moderator_status in ('none','denied');
  if found then
    perform log_activity('moderator_access_requested', 'profile', auth.uid(), null);
  end if;
end;
$$;
