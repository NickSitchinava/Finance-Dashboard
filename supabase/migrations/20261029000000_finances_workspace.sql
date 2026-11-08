-- Additive Finances workspace migration. Historical amounts remain untouched and
-- their currency remains NULL until the owner explicitly resolves it.
alter table public.transactions add column if not exists currency text;
alter table public.transactions add column if not exists project_id uuid references public.projects(id) on delete set null;
alter table public.transactions add column if not exists category_id uuid;
alter table public.transactions add column if not exists recurring_occurrence_id uuid;
alter table public.transactions add column if not exists invoice_id uuid references public.invoices(id) on delete set null;
alter table public.transactions add constraint transactions_currency_check check (currency is null or currency in ('USD','EUR','GEL')) not valid;
create index if not exists transactions_user_currency_idx on public.transactions(user_id,currency);
create index if not exists transactions_user_project_idx on public.transactions(user_id,project_id);

create table if not exists public.financial_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 60),
  type text not null check (type in ('Income','Expense')),
  icon text not null default 'tag',
  color text not null default '#7664CC' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  unique (id,user_id)
);
create unique index if not exists financial_categories_active_name_idx on public.financial_categories(user_id,type,lower(name)) where archived_at is null;
create index if not exists financial_categories_user_type_idx on public.financial_categories(user_id,type);
alter table public.financial_categories enable row level security;
create policy "Owner manages financial categories" on public.financial_categories for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
grant select,insert,update,delete on public.financial_categories to authenticated;
alter table public.transactions add constraint transactions_category_owner_fk foreign key (category_id,user_id) references public.financial_categories(id,user_id) not valid;

create table if not exists public.recurring_schedules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('Income','Expense')),
  amount numeric(18,2) not null check (amount>0),
  currency text not null check (currency in ('USD','EUR','GEL')),
  description text not null check (length(trim(description)) between 1 and 160),
  category_id uuid,
  category text,
  client_id uuid references public.clients(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  notes text,
  frequency text not null check (frequency in ('daily','weekly','monthly','yearly')),
  start_on date not null,
  end_on date,
  next_on date not null,
  occurrence_index integer not null default 0 check (occurrence_index>=0),
  time_zone text not null default 'Asia/Tbilisi',
  status text not null default 'active' check (status in ('active','paused','cancelled')),
  created_at timestamptz not null default now(),
  check (end_on is null or end_on>=start_on),
  foreign key (category_id,user_id) references public.financial_categories(id,user_id)
);
create index if not exists recurring_schedules_due_idx on public.recurring_schedules(status,next_on);
create index if not exists recurring_schedules_user_idx on public.recurring_schedules(user_id);
alter table public.recurring_schedules enable row level security;
create policy "Owner manages recurring schedules" on public.recurring_schedules for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
grant select,insert,update,delete on public.recurring_schedules to authenticated;

create table if not exists public.recurring_occurrences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  schedule_id uuid not null references public.recurring_schedules(id) on delete cascade,
  due_on date not null,
  status text not null default 'expected' check (status in ('expected','dismissed','recorded')),
  transaction_id uuid references public.transactions(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(schedule_id,due_on)
);
create index if not exists recurring_occurrences_user_due_idx on public.recurring_occurrences(user_id,due_on);
alter table public.recurring_occurrences enable row level security;
create policy "Owner views recurring occurrences" on public.recurring_occurrences for select to authenticated using ((select auth.uid())=user_id);
create policy "Owner updates recurring occurrences" on public.recurring_occurrences for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
grant select,update on public.recurring_occurrences to authenticated;
alter table public.transactions add constraint transactions_recurring_occurrence_fk foreign key (recurring_occurrence_id) references public.recurring_occurrences(id) not valid;
create unique index if not exists transactions_recurring_once_idx on public.transactions(recurring_occurrence_id) where recurring_occurrence_id is not null;

create schema if not exists private;
create or replace function private.check_financial_links()
returns trigger language plpgsql set search_path='' as $$
begin
  if tg_table_name='transactions' then
    if new.client_id is not null and not exists(select 1 from public.clients where id=new.client_id and user_id=new.user_id) then raise exception 'Client does not belong to owner'; end if;
    if new.project_id is not null and not exists(select 1 from public.projects where id=new.project_id and user_id=new.user_id) then raise exception 'Project does not belong to owner'; end if;
    if new.invoice_id is not null and not exists(select 1 from public.invoices where id=new.invoice_id and user_id=new.user_id) then raise exception 'Invoice does not belong to owner'; end if;
    if new.recurring_occurrence_id is not null and not exists(select 1 from public.recurring_occurrences where id=new.recurring_occurrence_id and user_id=new.user_id) then raise exception 'Occurrence does not belong to owner'; end if;
  elsif tg_table_name='recurring_schedules' then
    if new.client_id is not null and not exists(select 1 from public.clients where id=new.client_id and user_id=new.user_id) then raise exception 'Client does not belong to owner'; end if;
    if new.project_id is not null and not exists(select 1 from public.projects where id=new.project_id and user_id=new.user_id) then raise exception 'Project does not belong to owner'; end if;
  else
    if not exists(select 1 from public.recurring_schedules where id=new.schedule_id and user_id=new.user_id) then raise exception 'Schedule does not belong to owner'; end if;
    if new.transaction_id is not null and not exists(select 1 from public.transactions where id=new.transaction_id and user_id=new.user_id) then raise exception 'Transaction does not belong to owner'; end if;
  end if;
  return new;
end $$;
create trigger financial_transaction_links before insert or update of client_id,project_id,invoice_id,recurring_occurrence_id,user_id on public.transactions for each row execute function private.check_financial_links();
create trigger financial_schedule_links before insert or update of client_id,project_id,user_id on public.recurring_schedules for each row execute function private.check_financial_links();
create trigger financial_occurrence_links before update of schedule_id,transaction_id,user_id on public.recurring_occurrences for each row execute function private.check_financial_links();
create or replace function private.advance_financial_schedule(p_start date,p_frequency text,p_index integer)
returns date language sql immutable set search_path='' as $$
  select case p_frequency
    when 'daily' then p_start+p_index
    when 'weekly' then p_start+(p_index*7)
    when 'monthly' then (p_start+(p_index*interval '1 month'))::date
    else (p_start+(p_index*interval '1 year'))::date end
$$;
create or replace function private.generate_recurring_occurrences()
returns void language plpgsql security definer set search_path='' as $$
declare s record; v_date date; v_index integer; v_limit date;
begin
  for s in select * from public.recurring_schedules where status='active' and next_on<=((now() at time zone time_zone)::date) loop
    v_index := s.occurrence_index;
    v_limit := (now() at time zone s.time_zone)::date;
    for i in 1..3660 loop
      v_date := private.advance_financial_schedule(s.start_on,s.frequency,v_index);
      exit when v_date>v_limit or (s.end_on is not null and v_date>s.end_on);
      insert into public.recurring_occurrences(user_id,schedule_id,due_on) values(s.user_id,s.id,v_date) on conflict(schedule_id,due_on) do nothing;
      v_index := v_index+1;
    end loop;
    update public.recurring_schedules set occurrence_index=v_index,
      next_on=private.advance_financial_schedule(s.start_on,s.frequency,v_index),
      status=case when s.end_on is not null and private.advance_financial_schedule(s.start_on,s.frequency,v_index)>s.end_on then 'cancelled' else status end
    where id=s.id;
  end loop;
end $$;
revoke all on function private.generate_recurring_occurrences() from public,anon,authenticated;
revoke all on function private.advance_financial_schedule(date,text,integer) from public,anon,authenticated;
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('f_dash_recurring_expectations','13 0 * * *','select private.generate_recurring_occurrences()');
