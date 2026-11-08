-- Preserve legitimate transaction updates, including FK detachment during invoice deletion.
-- Active invoice payment transactions remain protected from direct edits and deletes.
create or replace function private.protect_invoice_payment_transaction()
returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
begin
  if exists(select 1 from public.invoice_payments where transaction_id=old.id and reversed_at is null) then
    raise exception 'Reverse the invoice payment before editing or deleting its income transaction';
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;
revoke all on function private.protect_invoice_payment_transaction() from public,anon,authenticated;
