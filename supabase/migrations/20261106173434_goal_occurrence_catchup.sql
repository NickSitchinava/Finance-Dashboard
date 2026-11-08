-- Fill scheduled dates missed during cron downtime. A date is never created
-- before the goal existed, and the unique key makes repeated runs idempotent.
create or replace function public.process_goal_occurrences() returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare
 g public.goals%rowtype;
 local_day date;
 anchor_date date;
 last_date date;
 scheduled_day date;
 due timestamptz;
 scheduled boolean;
 month_end_day int;
begin
 for g in select * from public.goals where recurrence is not null and status <> 'completed' loop
  begin
   local_day := (now() at time zone g.time_zone)::date;
   anchor_date := greatest(coalesce(g.start_date,(g.created_at at time zone g.time_zone)::date),(g.created_at at time zone g.time_zone)::date);
   select max(scheduled_date) into last_date from public.goal_occurrences where goal_id=g.id;
   for scheduled_day in select generate_series(coalesce(last_date+1,anchor_date),local_day,'1 day'::interval)::date loop
    month_end_day := extract(day from (date_trunc('month',scheduled_day::timestamp)+interval '1 month - 1 day'))::int;
    scheduled := g.recurrence='daily'
      or (g.recurrence='weekdays' and extract(isodow from scheduled_day)::int=any(g.recurrence_weekdays))
      or (g.recurrence='weekly' and extract(isodow from scheduled_day)::int=extract(isodow from anchor_date)::int)
      or (g.recurrence='monthly' and extract(day from scheduled_day)::int=least(extract(day from anchor_date)::int,month_end_day));
    if not scheduled then continue; end if;
    due := (scheduled_day + g.reminder_time) at time zone g.time_zone;
    if due > now() then continue; end if;
    insert into public.goal_occurrences(goal_id,user_id,scheduled_date,due_at,status,resolved_at)
    values(g.id,g.user_id,scheduled_day,due,case when scheduled_day<local_day then 'missed' else 'pending' end,
      case when scheduled_day<local_day then now() else null end)
    on conflict(goal_id,scheduled_date) do nothing;
   end loop;
   update public.goal_occurrences set status='missed',resolved_at=now()
    where goal_id=g.id and status='pending' and scheduled_date<local_day;
  exception when invalid_parameter_value then
   continue;
  end;
 end loop;
end $$;
revoke all on function public.process_goal_occurrences() from public,anon,authenticated;
