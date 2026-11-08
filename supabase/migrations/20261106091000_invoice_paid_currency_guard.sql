-- Payments and their linked income transactions retain the invoice's original currency.
create or replace function public.guard_paid_invoice_currency()
returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
  if new.currency is distinct from old.currency
     and exists (
       select 1 from public.invoice_payments p
       where p.invoice_id=old.id and p.reversed_at is null
     ) then
    raise exception 'Reverse recorded payments before changing invoice currency';
  end if;
  return new;
end $$;

drop trigger if exists guard_paid_invoice_currency on public.invoices;
create trigger guard_paid_invoice_currency
before update of currency on public.invoices
for each row execute function public.guard_paid_invoice_currency();
