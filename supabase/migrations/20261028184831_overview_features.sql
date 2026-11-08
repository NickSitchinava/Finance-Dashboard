-- Additive Overview storage. Existing project totals remain the application's hours source.
create table public.overview_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  layout_version integer not null default 1,
  widgets jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  constraint overview_widgets_array check (jsonb_typeof(widgets) = 'array')
);
alter table public.overview_preferences enable row level security;
create policy "Read own overview preferences" on public.overview_preferences for select to authenticated using ((select auth.uid()) = user_id);
create policy "Insert own overview preferences" on public.overview_preferences for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Update own overview preferences" on public.overview_preferences for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
grant select, insert, update on public.overview_preferences to authenticated;

create table public.time_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete restrict,
  state text not null check (state in ('running', 'paused', 'stopped')),
  started_at timestamptz not null default now(),
  segment_started_at timestamptz,
  accumulated_seconds numeric not null default 0 check (accumulated_seconds >= 0),
  stopped_at timestamptz,
  constraint time_session_state_consistency check (
    (state = 'running' and segment_started_at is not null and stopped_at is null) or
    (state = 'paused' and segment_started_at is null and stopped_at is null) or
    (state = 'stopped' and segment_started_at is null and stopped_at is not null)
  )
);
create unique index one_open_time_session_per_user on public.time_sessions(user_id) where state in ('running', 'paused');
create index time_sessions_user_started_idx on public.time_sessions(user_id, started_at desc);
create index time_sessions_project_idx on public.time_sessions(project_id);
alter table public.time_sessions enable row level security;
create policy "Read own time sessions" on public.time_sessions for select to authenticated using ((select auth.uid()) = user_id);
create policy "Insert own project sessions" on public.time_sessions for insert to authenticated with check (
  (select auth.uid()) = user_id and exists (select 1 from public.projects p where p.id = project_id and p.user_id = (select auth.uid()))
);
create policy "Update own time sessions" on public.time_sessions for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
grant select, insert, update on public.time_sessions to authenticated;

create function public.control_time_session(p_action text, p_project_id uuid default null)
returns public.time_sessions
language plpgsql security invoker set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_session public.time_sessions;
  v_seconds numeric;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  -- Serialize all timer requests for one user, including requests from multiple tabs.
  perform pg_advisory_xact_lock(hashtextextended(v_user::text, 0));
  select * into v_session from public.time_sessions
    where user_id = v_user and state in ('running', 'paused') for update;
  if p_action = 'start' then
    if v_session.id is not null then raise exception 'A time session is already open'; end if;
    if p_project_id is null or not exists (
      select 1 from public.projects where id = p_project_id and user_id = v_user and status <> 'Completed'
    ) then raise exception 'Select an available project'; end if;
    insert into public.time_sessions(user_id, project_id, state, segment_started_at)
      values (v_user, p_project_id, 'running', now()) returning * into v_session;
  elsif p_action = 'pause' and v_session.state = 'running' then
    update public.time_sessions set state = 'paused',
      accumulated_seconds = accumulated_seconds + extract(epoch from now() - segment_started_at),
      segment_started_at = null where id = v_session.id returning * into v_session;
  elsif p_action = 'resume' and v_session.state = 'paused' then
    update public.time_sessions set state = 'running', segment_started_at = now()
      where id = v_session.id returning * into v_session;
  elsif p_action = 'stop' and v_session.id is not null then
    v_seconds := v_session.accumulated_seconds + case when v_session.state = 'running'
      then extract(epoch from now() - v_session.segment_started_at) else 0 end;
    update public.time_sessions set state = 'stopped', accumulated_seconds = v_seconds,
      segment_started_at = null, stopped_at = now()
      where id = v_session.id returning * into v_session;
    update public.projects set hours_logged = coalesce(hours_logged, 0) + v_seconds / 3600
      where id = v_session.project_id and user_id = v_user;
    if not found then raise exception 'Project is unavailable; session was not stopped'; end if;
  else
    raise exception 'Invalid timer transition';
  end if;
  return v_session;
end;
$$;
revoke all on function public.control_time_session(text, uuid) from public, anon;
grant execute on function public.control_time_session(text, uuid) to authenticated;
