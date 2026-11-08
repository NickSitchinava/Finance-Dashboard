-- Recovery copies are deliberately outside the exposed public schema.
create schema if not exists private;
create table private.goals_backup_20261106 as table public.goals;
create table private.milestones_backup_20261106 as table public.milestones;
revoke all on private.goals_backup_20261106, private.milestones_backup_20261106 from public, anon, authenticated;

-- The reset affects only the two legacy workspaces. There are no incoming FKs,
-- dependent views/functions, or custom triggers as checked on 2026-11-06.
delete from public.goals;
drop table public.milestones;

alter table public.goals drop column category;
alter table public.goals alter column target_date drop not null;
alter table public.goals add column description text not null default '';
alter table public.goals add column priority text not null default 'medium' check (priority in ('low','medium','high'));
alter table public.goals add column horizon text not null default 'short' check (horizon in ('short','long'));
alter table public.goals add column start_date date;
alter table public.goals add column status text not null default 'not_started' check (status in ('not_started','in_progress','completed'));
alter table public.goals add column progress_method text not null default 'manual' check (progress_method in ('manual','checklist','subgoals'));
alter table public.goals add column completed_at timestamptz;
alter table public.goals add column updated_at timestamptz not null default now();
alter table public.goals add column sort_order integer not null default 0;
alter table public.goals add column reference_links jsonb not null default '[]'::jsonb check (jsonb_typeof(reference_links)='array');
alter table public.goals add column recurrence text check (recurrence in ('daily','weekdays','weekly','monthly'));
alter table public.goals add column recurrence_weekdays integer[];
alter table public.goals add column reminder_time time;
alter table public.goals add column time_zone text;
alter table public.goals add constraint goals_progress_range check (percent_complete between 0 and 100);
alter table public.goals add constraint goals_recurring_schedule check (recurrence is null or (reminder_time is not null and time_zone is not null));
alter table public.goals add constraint goals_owner_unique unique(id,user_id);
create index goals_owner_status_idx on public.goals(user_id,status,sort_order);
drop policy if exists "Users can update own goals" on public.goals;
create policy "Users can update own goals" on public.goals for update to authenticated
  using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);

create table public.goal_steps (
  id uuid primary key default gen_random_uuid(), goal_id uuid not null, user_id uuid not null references auth.users(id),
  kind text not null check(kind in ('checklist','subgoal')), title text not null check(length(trim(title))>0),
  description text not null default '', target_date date, completed boolean not null default false,
  sort_order integer not null default 0, created_at timestamptz not null default now(),
  foreign key(goal_id,user_id) references public.goals(id,user_id) on delete cascade
);
create index goal_steps_owner_goal_idx on public.goal_steps(user_id,goal_id,kind,sort_order);
alter table public.goal_steps enable row level security;
create policy "Own goal steps" on public.goal_steps for all to authenticated
 using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);

create table public.goal_progress_events (
 id uuid primary key default gen_random_uuid(), goal_id uuid not null, user_id uuid not null references auth.users(id),
 progress numeric not null check(progress between 0 and 100), recorded_at timestamptz not null default now(),
 foreign key(goal_id,user_id) references public.goals(id,user_id) on delete cascade
);
create index goal_progress_events_owner_date_idx on public.goal_progress_events(user_id,recorded_at);
alter table public.goal_progress_events enable row level security;
create policy "Own goal progress events" on public.goal_progress_events for all to authenticated
 using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);

create table public.goal_occurrences (
 id uuid primary key default gen_random_uuid(), goal_id uuid not null, user_id uuid not null references auth.users(id),
 scheduled_date date not null, due_at timestamptz not null,
 status text not null default 'pending' check(status in ('pending','completed','missed')),
 resolved_at timestamptz, created_at timestamptz not null default now(),
 unique(goal_id,scheduled_date), foreign key(goal_id,user_id) references public.goals(id,user_id) on delete cascade
);
create index goal_occurrences_owner_due_idx on public.goal_occurrences(user_id,due_at,status);
alter table public.goal_occurrences enable row level security;
create policy "Own goal occurrences" on public.goal_occurrences for select to authenticated
 using ((select auth.uid())=user_id);
create policy "Resolve own goal occurrences" on public.goal_occurrences for update to authenticated
 using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);

-- UTC cron checks each user's local date and time. An unanswered earlier
-- occurrence becomes missed only after its local day ends. The unique key
-- makes repeated cron executions idempotent.
create or replace function public.process_goal_occurrences() returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare g public.goals%rowtype; local_now timestamp; local_day date; day_of_week int; due timestamptz;
begin
 for g in select * from public.goals where recurrence is not null and status <> 'completed' loop
  begin
   local_now := now() at time zone g.time_zone;
   local_day := local_now::date;
   day_of_week := extract(isodow from local_day);
   if g.start_date is not null and local_day < g.start_date then continue; end if;
   if g.recurrence='daily'
     or (g.recurrence='weekdays' and day_of_week=any(g.recurrence_weekdays))
     or (g.recurrence='weekly' and day_of_week=coalesce(extract(isodow from g.start_date)::int,1))
     or (g.recurrence='monthly' and extract(day from local_day)=coalesce(extract(day from g.start_date)::int,1)) then
    due := (local_day + g.reminder_time) at time zone g.time_zone;
    if now() >= due then
     insert into public.goal_occurrences(goal_id,user_id,scheduled_date,due_at)
     values(g.id,g.user_id,local_day,due) on conflict(goal_id,scheduled_date) do nothing;
    end if;
   end if;
   update public.goal_occurrences set status='missed',resolved_at=now()
    where goal_id=g.id and status='pending' and scheduled_date < local_day;
  exception when invalid_parameter_value then
   -- A bad timezone on one legacy row cannot stop every user's reminders.
   continue;
  end;
 end loop;
end $$;
revoke all on function public.process_goal_occurrences() from public,anon,authenticated;
select cron.schedule('f-dash-goal-occurrences','*/15 * * * *','select public.process_goal_occurrences()');

grant select,insert,update,delete on public.goals,public.goal_steps,public.goal_progress_events to authenticated;
grant select,update on public.goal_occurrences to authenticated;
