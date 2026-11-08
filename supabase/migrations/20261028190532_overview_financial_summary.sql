-- Aggregate transaction history without sending every financial row to the browser.
create index transactions_user_date_idx on public.transactions(user_id, date);
create index transactions_user_created_idx on public.transactions(user_id, created_at desc);

create function public.overview_financial_summary(p_from date)
returns jsonb
language sql stable security invoker set search_path = public
as $$
  with totals as (
    select
      coalesce(sum(coalesce(income_amount, case when type = 'Income' then amount else 0 end)), 0) as revenue,
      coalesce(sum(coalesce(expense_amount, case when type = 'Expense' then amount else 0 end)), 0) as expenses
    from public.transactions
    where user_id = (select auth.uid())
  ),
  daily as (
    select date,
      sum(coalesce(income_amount, case when type = 'Income' then amount else 0 end)) as revenue,
      sum(coalesce(expense_amount, case when type = 'Expense' then amount else 0 end)) as expenses
    from public.transactions
    where user_id = (select auth.uid()) and date >= p_from
    group by date
  )
  select jsonb_build_object(
    'revenue', totals.revenue,
    'expenses', totals.expenses,
    'days', (select coalesce(jsonb_agg(jsonb_build_object('date', date, 'revenue', revenue, 'expenses', expenses) order by date), '[]'::jsonb) from daily)
  )
  from totals;
$$;
revoke all on function public.overview_financial_summary(date) from public, anon;
grant execute on function public.overview_financial_summary(date) to authenticated;
