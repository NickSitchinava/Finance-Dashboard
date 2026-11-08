alter table public.project_work_reviews
add column standard_week_hours numeric(5,2) not null default 40
check (standard_week_hours between 10 and 80);
