-- Permanently delete one owned invoice while preserving received income in Finances.
-- Related invoice payment rows, line items, reminders, and recurrence schedules are removed.
-- Existing financial transactions remain and lose only their invoice association.
create or replace function public.delete_invoice(p_invoice_id uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_owner uuid := (select auth.uid());
begin
  if v_owner is null then raise exception 'Sign in required'; end if;

  perform 1 from public.invoices
    where id=p_invoice_id and user_id=v_owner for update;
  if not found then raise exception 'Invoice not found'; end if;

  delete from public.invoice_payments
    where invoice_id=p_invoice_id and user_id=v_owner;
  delete from public.invoice_recurrences
    where template_invoice_id=p_invoice_id and user_id=v_owner;
  delete from public.invoices
    where id=p_invoice_id and user_id=v_owner;
end $$;

revoke all on function public.delete_invoice(uuid) from public, anon;
grant execute on function public.delete_invoice(uuid) to authenticated;
