-- Existing invoices without an issue date stay untouched.
alter table public.invoices add constraint invoice_date_order
check (issue_date is null or due_date >= issue_date) not valid;
