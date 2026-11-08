-- Pending reminders tied to an old schedule must not be presented as current.
-- Resolved occurrences remain as historical evidence.
create or replace function private.reconcile_goal_schedule()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if old.recurrence is distinct from new.recurrence
  or old.recurrence_weekdays is distinct from new.recurrence_weekdays
  or old.reminder_time is distinct from new.reminder_time
  or old.time_zone is distinct from new.time_zone
  or old.start_date is distinct from new.start_date
  or (old.status is distinct from new.status and new.status='completed') then
  delete from public.goal_occurrences where goal_id=new.id and status='pending';
 end if;
 return new;
end $$;
revoke all on function private.reconcile_goal_schedule() from public,anon,authenticated;
create trigger goal_schedule_reconciliation after update of
 recurrence,recurrence_weekdays,reminder_time,time_zone,start_date,status on public.goals
 for each row execute function private.reconcile_goal_schedule();
