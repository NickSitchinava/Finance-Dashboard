-- Additive invoice workspace. Legacy numbers, statuses and amounts are retained.
alter table public.invoices add column if not exists lifecycle_state text not null default 'issued';
alter table public.invoices add column if not exists project_id uuid references public.projects(id) on delete set null;
alter table public.invoices add column if not exists issue_date date;
alter table public.invoices add column if not exists notes text;
alter table public.invoices add column if not exists payment_terms text;
alter table public.invoices add column if not exists recipient_snapshot jsonb not null default '{}'::jsonb;
alter table public.invoices add column if not exists issuer_snapshot jsonb not null default '{}'::jsonb;
alter table public.invoices add column if not exists archived_at timestamptz;
alter table public.invoices add column if not exists updated_at timestamptz not null default now();
alter table public.invoices add column if not exists recurrence_id uuid;
alter table public.invoices add column if not exists recurrence_occurrence date;
alter table public.invoices drop constraint if exists invoices_lifecycle_check;
alter table public.invoices add constraint invoices_lifecycle_check check (lifecycle_state in ('draft','issued'));
create unique index if not exists invoices_owner_number_unique on public.invoices(user_id,invoice_number);
create unique index if not exists invoices_recurrence_occurrence_unique on public.invoices(recurrence_id,recurrence_occurrence) where recurrence_id is not null;
create index if not exists invoices_owner_due_active on public.invoices(user_id,due_date) where archived_at is null;

create table if not exists public.invoice_line_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  description text not null,
  quantity numeric(14,3) not null check (quantity > 0),
  unit_rate numeric(14,2) not null check (unit_rate >= 0),
  sort_order integer not null default 0
);
create index if not exists invoice_line_items_invoice_idx on public.invoice_line_items(invoice_id,sort_order);

create table if not exists public.invoice_payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric(14,2) not null check (amount > 0),
  currency text not null check (currency in ('USD','EUR','GEL')),
  paid_on date not null,
  note text,
  method text,
  reference text,
  transaction_id uuid unique references public.transactions(id) on delete set null,
  idempotency_key uuid not null,
  reversed_at timestamptz,
  created_at timestamptz not null default now(),
  unique(user_id,idempotency_key)
);
create index if not exists invoice_payments_invoice_idx on public.invoice_payments(invoice_id,created_at);

create table if not exists public.invoice_recurrences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  template_invoice_id uuid not null references public.invoices(id),
  frequency text not null check (frequency in ('weekly','monthly','quarterly','yearly')),
  next_on date not null,
  end_on date,
  max_occurrences integer check (max_occurrences is null or max_occurrences > 0),
  generated_count integer not null default 0,
  state text not null default 'active' check (state in ('active','paused','cancelled')),
  created_at timestamptz not null default now()
);
alter table public.invoices add constraint invoices_recurrence_fk foreign key (recurrence_id) references public.invoice_recurrences(id) on delete set null;

create table if not exists public.invoice_notification_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  event_key text not null,
  title text not null,
  body text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  unique(invoice_id,event_key)
);
create index if not exists invoice_notifications_owner_idx on public.invoice_notification_events(user_id,created_at desc);

alter table public.invoice_line_items enable row level security;
alter table public.invoice_payments enable row level security;
alter table public.invoice_recurrences enable row level security;
alter table public.invoice_notification_events enable row level security;
create policy invoice_line_items_owner on public.invoice_line_items for all to authenticated using ((select auth.uid())=user_id and exists(select 1 from public.invoices i where i.id=invoice_id and i.user_id=user_id)) with check ((select auth.uid())=user_id and exists(select 1 from public.invoices i where i.id=invoice_id and i.user_id=user_id));
create policy invoice_payments_read on public.invoice_payments for select to authenticated using ((select auth.uid())=user_id);
create policy invoice_recurrences_owner on public.invoice_recurrences for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id and exists(select 1 from public.invoices i where i.id=template_invoice_id and i.user_id=user_id));
create policy invoice_notifications_owner on public.invoice_notification_events for select to authenticated using ((select auth.uid())=user_id);
create policy invoice_notifications_update on public.invoice_notification_events for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
grant select,insert,update,delete on public.invoice_line_items to authenticated;
grant select on public.invoice_payments to authenticated;
grant select,insert,update,delete on public.invoice_recurrences to authenticated;
grant select,update on public.invoice_notification_events to authenticated;

create table if not exists private.invoice_number_counters (user_id uuid primary key, next_value bigint not null default 1);

create or replace function public.activate_invoice(p_invoice_id uuid)
returns public.invoices language plpgsql security definer set search_path = public, pg_temp as $$
declare v_invoice public.invoices; v_seq bigint; v_number text;
begin
  select * into v_invoice from public.invoices where id=p_invoice_id and user_id=(select auth.uid()) for update;
  if not found then raise exception 'Invoice not found'; end if;
  if v_invoice.lifecycle_state <> 'draft' then return v_invoice; end if;
  if v_invoice.client_name='' or v_invoice.currency is null or v_invoice.amount<=0 or v_invoice.due_date is null then raise exception 'Complete the recipient, amount, currency and due date'; end if;
  insert into private.invoice_number_counters(user_id,next_value) values(v_invoice.user_id,1) on conflict do nothing;
  update private.invoice_number_counters set next_value=next_value+1 where user_id=v_invoice.user_id returning next_value-1 into v_seq;
  v_number := 'INV-' || to_char(current_date,'YYYY') || '-' || lpad(v_seq::text,5,'0');
  while exists(select 1 from public.invoices where user_id=v_invoice.user_id and invoice_number=v_number and id<>v_invoice.id) loop
    update private.invoice_number_counters set next_value=next_value+1 where user_id=v_invoice.user_id returning next_value-1 into v_seq;
    v_number := 'INV-' || to_char(current_date,'YYYY') || '-' || lpad(v_seq::text,5,'0');
  end loop;
  update public.invoices set lifecycle_state='issued',invoice_number=v_number,status='Pending',issue_date=coalesce(issue_date,current_date),updated_at=now() where id=p_invoice_id returning * into v_invoice;
  return v_invoice;
end $$;
grant execute on function public.activate_invoice(uuid) to authenticated;
revoke all on function public.activate_invoice(uuid) from public, anon;

create or replace function public.record_invoice_payment(p_invoice_id uuid,p_amount numeric,p_currency text,p_paid_on date,p_note text,p_method text,p_reference text,p_key uuid)
returns public.invoice_payments language plpgsql security definer set search_path=public,pg_temp as $$
declare v_invoice public.invoices; v_payment public.invoice_payments; v_paid numeric; v_transaction uuid;
begin
  if (select auth.uid()) is null then raise exception 'Sign in required'; end if;
  select * into v_payment from public.invoice_payments where user_id=(select auth.uid()) and idempotency_key=p_key;
  if found then return v_payment; end if;
  select * into v_invoice from public.invoices where id=p_invoice_id and user_id=(select auth.uid()) for update;
  if not found or v_invoice.archived_at is not null or v_invoice.lifecycle_state<>'issued' then raise exception 'Active invoice not found'; end if;
  if p_currency is distinct from v_invoice.currency then raise exception 'Payment currency must match invoice currency'; end if;
  if p_amount is null or p_amount<=0 or p_amount<>round(p_amount,2) then raise exception 'Enter a positive amount with at most two decimals'; end if;
  select coalesce(sum(amount),0) into v_paid from public.invoice_payments where invoice_id=p_invoice_id and reversed_at is null;
  if p_amount>v_invoice.amount-v_paid then raise exception 'Payment exceeds remaining balance'; end if;
  insert into public.transactions(user_id,client_id,project_id,invoice_id,type,amount,income_amount,description,date,currency,category,income_category)
    values(v_invoice.user_id,v_invoice.client_id,v_invoice.project_id,v_invoice.id,'Income',p_amount,p_amount,'Invoice '||v_invoice.invoice_number||' payment',p_paid_on,p_currency,'Invoice payment','Invoice payment') returning id into v_transaction;
  insert into public.invoice_payments(invoice_id,user_id,amount,currency,paid_on,note,method,reference,transaction_id,idempotency_key)
    values(p_invoice_id,v_invoice.user_id,p_amount,p_currency,p_paid_on,p_note,p_method,p_reference,v_transaction,p_key) returning * into v_payment;
  update public.invoices set status=case when v_paid+p_amount>=amount then 'Paid' else 'Pending' end,updated_at=now() where id=p_invoice_id;
  return v_payment;
end $$;
grant execute on function public.record_invoice_payment(uuid,numeric,text,date,text,text,text,uuid) to authenticated;
revoke all on function public.record_invoice_payment(uuid,numeric,text,date,text,text,text,uuid) from public, anon;

create or replace function public.reverse_invoice_payment(p_payment_id uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare v_payment public.invoice_payments; v_invoice public.invoices; v_paid numeric;
begin
  select i.* into v_invoice from public.invoices i join public.invoice_payments p on p.invoice_id=i.id where p.id=p_payment_id and i.user_id=(select auth.uid()) for update of i;
  if not found then raise exception 'Payment not found'; end if;
  select * into v_payment from public.invoice_payments where id=p_payment_id and user_id=(select auth.uid()) for update;
  if v_payment.reversed_at is not null then return; end if;
  update public.invoice_payments set reversed_at=now() where id=p_payment_id;
  if v_payment.transaction_id is not null then delete from public.transactions where id=v_payment.transaction_id and user_id=v_payment.user_id and invoice_id=v_invoice.id; end if;
  select coalesce(sum(amount),0) into v_paid from public.invoice_payments where invoice_id=v_invoice.id and reversed_at is null;
  update public.invoices set status=case when v_paid>=amount then 'Paid' else 'Pending' end,updated_at=now() where id=v_invoice.id;
end $$;
grant execute on function public.reverse_invoice_payment(uuid) to authenticated;
revoke all on function public.reverse_invoice_payment(uuid) from public, anon;

create or replace function public.process_invoice_reminders()
returns void language plpgsql security invoker set search_path=public,pg_temp as $$
declare v record; v_days integer; v_key text; v_title text;
begin
  for v in select i.*,coalesce((select sum(p.amount) from public.invoice_payments p where p.invoice_id=i.id and p.reversed_at is null),0) paid
    from public.invoices i where i.lifecycle_state='issued' and i.archived_at is null and i.due_date is not null loop
    if v.amount<=v.paid then continue; end if;
    v_days := v.due_date-(now() at time zone 'Asia/Tbilisi')::date;
    if v_days not in (14,7,2,1,-1,-3,-7,-14) and not (v_days< -14 and mod(-v_days-14,7)=0) then continue; end if;
    v_key := v.due_date::text||':'||v_days::text;
    v_title := case when v_days<0 then 'Overdue payment' else 'Upcoming payment' end;
    insert into public.invoice_notification_events(user_id,invoice_id,event_key,title,body)
      values(v.user_id,v.id,v_key,v_title,v.client_name||' · '||v.invoice_number||' · '||to_char(v.amount-v.paid,'FM9999999990.00')||' '||coalesce(v.currency,'')||case when v_days<0 then ' · '||(-v_days)||' days overdue' else ' · due in '||v_days||' days' end)
      on conflict(invoice_id,event_key) do nothing;
  end loop;
end $$;
revoke all on function public.process_invoice_reminders() from public, anon, authenticated;

create or replace function public.generate_recurring_invoice_drafts()
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare v public.invoice_recurrences; v_template public.invoices; v_new_id uuid; v_next date; v_step integer;
begin
  for v in select * from public.invoice_recurrences where state='active' and next_on <= (now() at time zone 'Asia/Tbilisi')::date for update skip locked loop
    select * into v_template from public.invoices where id=v.template_invoice_id and user_id=v.user_id;
    if not found or v_template.archived_at is not null then continue; end if;
    while v.next_on <= (now() at time zone 'Asia/Tbilisi')::date loop
      if (v.end_on is not null and v.next_on>v.end_on) or (v.max_occurrences is not null and v.generated_count>=v.max_occurrences) then
        update public.invoice_recurrences set state='cancelled' where id=v.id; exit;
      end if;
      insert into public.invoices(user_id,client_id,client_name,project_id,invoice_number,amount,currency,due_date,status,description,lifecycle_state,issue_date,notes,payment_terms,recipient_snapshot,issuer_snapshot,recurrence_id,recurrence_occurrence)
        values(v.user_id,v_template.client_id,v_template.client_name,v_template.project_id,'DRAFT-'||gen_random_uuid()::text,v_template.amount,v_template.currency,v.next_on,'Pending',v_template.description,'draft',v.next_on,v_template.notes,v_template.payment_terms,v_template.recipient_snapshot,v_template.issuer_snapshot,v.id,v.next_on)
        on conflict do nothing returning id into v_new_id;
      if v_new_id is not null then
        insert into public.invoice_line_items(invoice_id,user_id,description,quantity,unit_rate,sort_order)
          select v_new_id,v.user_id,description,quantity,unit_rate,sort_order from public.invoice_line_items where invoice_id=v.template_invoice_id;
        v.generated_count:=v.generated_count+1;
      end if;
      v_step:=case v.frequency when 'weekly' then 0 when 'monthly' then 1 when 'quarterly' then 3 else 12 end;
      if v.frequency='weekly' then v_next:=v.next_on+7;
      else
        v_next:=((date_trunc('month',v.next_on)::date + make_interval(months=>v_step))::date +
          least(extract(day from v.next_on)::integer,extract(day from ((date_trunc('month',v.next_on)::date + make_interval(months=>v_step+1))::date - 1))::integer)-1);
      end if;
      v.next_on:=v_next;
      update public.invoice_recurrences set next_on=v.next_on,generated_count=v.generated_count where id=v.id;
      v_new_id:=null;
    end loop;
  end loop;
end $$;
revoke all on function public.generate_recurring_invoice_drafts() from public, anon, authenticated;

select cron.schedule('f-dash-invoice-reminders','10 5 * * *','select public.process_invoice_reminders()');
select cron.schedule('f-dash-recurring-invoices','15 5 * * *','select public.generate_recurring_invoice_drafts()');
