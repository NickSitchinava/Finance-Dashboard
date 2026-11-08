-- Existing invoices had no original currency. Preserve them as unresolved.
alter table public.invoices add column if not exists currency text;
alter table public.invoices add constraint invoices_currency_check
  check (currency is null or currency in ('USD','EUR','GEL')) not valid;
grant select, insert, update on public.invoices to authenticated;
