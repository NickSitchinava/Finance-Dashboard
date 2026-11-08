-- Document writes must use the atomic save function; users can only mark reminders read.
revoke insert,update,delete on public.invoice_line_items from authenticated;
revoke update on public.invoice_notification_events from authenticated;
grant update(read_at) on public.invoice_notification_events to authenticated;
