-- Keep historical reminders while clearing notifications for obsolete schedules.
create or replace function private.reconcile_invoice_notifications()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if old.due_date is distinct from new.due_date
    or old.lifecycle_state is distinct from new.lifecycle_state
    or old.archived_at is distinct from new.archived_at
    or (old.status is distinct from new.status and new.status='Paid') then
    update public.invoice_notification_events
      set read_at=coalesce(read_at,now())
      where invoice_id=new.id and read_at is null;
  end if;
  return new;
end $$;
revoke all on function private.reconcile_invoice_notifications() from public,anon,authenticated;
create trigger invoice_reminder_reconciliation
after update of due_date,lifecycle_state,archived_at,status on public.invoices
for each row execute function private.reconcile_invoice_notifications();
