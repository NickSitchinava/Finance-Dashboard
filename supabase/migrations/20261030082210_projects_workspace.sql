-- Preserve legacy project IDs, dates, links, hours and manually entered progress.
-- New progress is derived from project_tasks; legacy values remain for older views.
alter table public.projects alter column client_id drop not null;
alter table public.projects alter column start_date drop not null;
alter table public.projects alter column deadline drop not null;
alter table public.projects add column if not exists kind text;
update public.projects set kind = case when client_id is null then 'personal' else 'client' end where kind is null;
alter table public.projects alter column kind set default 'personal';
alter table public.projects alter column kind set not null;
alter table public.projects add constraint projects_kind_check check (kind in ('client','personal'));
alter table public.projects add column if not exists description text;
alter table public.projects add column if not exists estimated_weeks numeric(8,2) check (estimated_weeks is null or estimated_weeks >= 0);
alter table public.projects add column if not exists estimated_cost numeric(14,2) check (estimated_cost is null or estimated_cost >= 0);
alter table public.projects add column if not exists agreed_payment numeric(14,2) check (agreed_payment is null or agreed_payment >= 0);
alter table public.projects add column if not exists budget_currency text check (budget_currency is null or budget_currency in ('USD','EUR','GEL'));
alter table public.projects add column if not exists payment_due_on date;
alter table public.projects add column if not exists updated_at timestamptz not null default now();
alter table public.projects add constraint projects_client_kind_check check (kind <> 'personal' or client_id is null);
create unique index if not exists projects_id_user_unique on public.projects(id,user_id);
create index if not exists projects_owner_kind_updated_idx on public.projects(user_id,kind,updated_at desc);

create table public.project_tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  user_id uuid not null,
  title text not null check (length(trim(title)) between 1 and 200),
  description text,
  status text not null default 'todo' check (status in ('todo','doing','done')),
  priority text not null default 'normal' check (priority in ('low','normal','high')),
  due_on date,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (project_id,user_id) references public.projects(id,user_id) on delete cascade
);
create index project_tasks_project_status_idx on public.project_tasks(project_id,status);

create table public.project_notes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  user_id uuid not null,
  content text not null check (length(trim(content)) between 1 and 20000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (project_id,user_id) references public.projects(id,user_id) on delete cascade
);
create index project_notes_project_created_idx on public.project_notes(project_id,created_at desc);

create table public.project_links (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  user_id uuid not null,
  title text not null check (length(trim(title)) between 1 and 120),
  url text not null check (url ~* '^https://[^[:space:]]+$'),
  created_at timestamptz not null default now(),
  foreign key (project_id,user_id) references public.projects(id,user_id) on delete cascade
);
create index project_links_project_idx on public.project_links(project_id);

create table public.github_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  github_account_id bigint not null,
  github_login text not null,
  installation_id bigint not null unique,
  state text not null default 'connected' check (state in ('connected','error','reauthorization_required')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id,installation_id)
);
create index github_connections_user_idx on public.github_connections(user_id);

create table public.github_repositories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  connection_id uuid not null references public.github_connections(id) on delete cascade,
  project_id uuid not null,
  github_repository_id bigint not null,
  full_name text not null,
  html_url text not null,
  state text not null default 'connected' check (state in ('connected','syncing','delayed','error','reauthorization_required')),
  last_synced_at timestamptz,
  checkpoint_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  foreign key (project_id,user_id) references public.projects(id,user_id) on delete cascade,
  unique(user_id,github_repository_id)
);
create index github_repositories_project_idx on public.github_repositories(project_id);

create table public.github_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  project_id uuid not null,
  repository_id uuid not null references public.github_repositories(id) on delete cascade,
  event_key text not null,
  kind text not null check (kind in ('commit','pull_request','merge')),
  title text not null,
  html_url text not null,
  author_login text,
  occurred_at timestamptz not null,
  source text not null check (source in ('webhook','backfill','reconcile')),
  synced_at timestamptz not null default now(),
  foreign key (project_id,user_id) references public.projects(id,user_id) on delete cascade,
  unique(repository_id,event_key)
);
create index github_events_project_date_idx on public.github_events(project_id,occurred_at desc);
create index github_events_owner_date_idx on public.github_events(user_id,occurred_at desc);

create table public.project_work_reviews (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  user_id uuid not null,
  week_start date not null,
  week_end date generated always as (week_start + 6) stored,
  estimated_weeks numeric(8,3),
  confirmed_weeks numeric(8,3) not null check (confirmed_weeks >= 0 and confirmed_weeks <= 7),
  confirmation_method text not null check (confirmation_method in ('accepted','manual')),
  estimation_version text,
  confirmed_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (project_id,user_id) references public.projects(id,user_id) on delete cascade,
  check (extract(isodow from week_start) = 1),
  unique(project_id,user_id,week_start)
);
create index project_work_reviews_project_idx on public.project_work_reviews(project_id,week_start desc);

create table public.project_work_review_revisions (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.project_work_reviews(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  previous_weeks numeric(8,3) not null,
  revised_weeks numeric(8,3) not null,
  changed_at timestamptz not null default now()
);

-- Child rows carry a composite FK to their owner's project, so ownership cannot be reassigned.
alter table public.project_tasks enable row level security;
alter table public.project_notes enable row level security;
alter table public.project_links enable row level security;
alter table public.github_connections enable row level security;
alter table public.github_repositories enable row level security;
alter table public.github_events enable row level security;
alter table public.project_work_reviews enable row level security;
alter table public.project_work_review_revisions enable row level security;

create policy project_tasks_owner on public.project_tasks for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy project_notes_owner on public.project_notes for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy project_links_owner on public.project_links for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy github_connections_read on public.github_connections for select to authenticated using ((select auth.uid()) = user_id);
create policy github_repositories_read on public.github_repositories for select to authenticated using ((select auth.uid()) = user_id);
create policy github_events_read on public.github_events for select to authenticated using ((select auth.uid()) = user_id);
create policy project_work_reviews_owner on public.project_work_reviews for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy project_work_review_revisions_read on public.project_work_review_revisions for select to authenticated using ((select auth.uid()) = user_id);

grant select,insert,update,delete on public.project_tasks, public.project_notes, public.project_links, public.project_work_reviews to authenticated;
grant select on public.github_connections, public.github_repositories, public.github_events, public.project_work_review_revisions to authenticated;

-- Existing manual github_activity remains untouched for history, but is no longer used by the Projects UI.
