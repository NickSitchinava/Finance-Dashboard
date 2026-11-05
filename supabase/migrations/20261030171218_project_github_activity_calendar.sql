create or replace function public.project_github_activity_calendar(
  p_since date,
  p_timezone text default 'UTC'
)
returns table(
  activity_day date,
  commit_count bigint,
  pull_request_count bigint,
  merge_count bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  with scoped as (
    select
      (occurred_at at time zone p_timezone)::date as day,
      kind
    from public.github_events
    where user_id = (select auth.uid())
      and occurred_at >= (p_since::timestamp at time zone p_timezone)
      and occurred_at <= now()
  )
  select
    day,
    count(*) filter (where kind = 'commit'),
    count(*) filter (where kind = 'pull_request'),
    count(*) filter (where kind = 'merge')
  from scoped
  where day >= p_since
  group by day
  order by day;
$$;

revoke all on function public.project_github_activity_calendar(date, text) from public;
grant execute on function public.project_github_activity_calendar(date, text) to authenticated;
