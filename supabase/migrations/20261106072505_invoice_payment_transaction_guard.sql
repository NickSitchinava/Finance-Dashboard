-- Invoice-created income is corrected through payment reversal, keeping both ledgers aligned.
create or replace function private.protect_invoice_payment_transaction()
returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
begin
  if exists(select 1 from public.invoice_payments where transaction_id=old.id and reversed_at is null) then
    raise exception 'Reverse the invoice payment before editing or deleting its income transaction';
  end if;
  return old;
end $$;
revoke all on function private.protect_invoice_payment_transaction() from public,anon,authenticated;
create trigger protect_invoice_payment_transaction
before update or delete on public.transactions
for each row execute function private.protect_invoice_payment_transaction();
