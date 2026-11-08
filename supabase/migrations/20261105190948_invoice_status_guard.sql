create or replace function private.derive_invoice_legacy_status()
returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
declare v_paid numeric;
begin
  if new.lifecycle_state='draft' then new.status:='Pending'; return new; end if;
  if new.amount<=0 then raise exception 'Issued invoice amount must be positive'; end if;
  if tg_op='INSERT' then v_paid:=0;
  else select coalesce(sum(amount),0) into v_paid from public.invoice_payments where invoice_id=new.id and reversed_at is null;
  end if;
  new.status:=case when v_paid>=new.amount then 'Paid' else 'Pending' end;
  return new;
end $$;
revoke all on function private.derive_invoice_legacy_status() from public,anon,authenticated;
create trigger invoice_status_guard
before insert or update of status,amount,lifecycle_state on public.invoices
for each row execute function private.derive_invoice_legacy_status();
revoke delete on public.invoices from authenticated;
