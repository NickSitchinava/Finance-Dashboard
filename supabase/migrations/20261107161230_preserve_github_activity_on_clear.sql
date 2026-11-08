-- GitHub synchronization and activity belong to the account even when the
-- associated F-Dash project is removed. Detach the project reference instead.
alter table public.github_repositories
  drop constraint github_repositories_project_id_user_id_fkey;
alter table public.github_repositories alter column project_id drop not null;
alter table public.github_repositories
  add constraint github_repositories_project_id_user_id_fkey
  foreign key (project_id, user_id) references public.projects(id, user_id)
  on delete set null (project_id);

alter table public.github_events
  drop constraint github_events_project_id_user_id_fkey;
alter table public.github_events alter column project_id drop not null;
alter table public.github_events
  add constraint github_events_project_id_user_id_fkey
  foreign key (project_id, user_id) references public.projects(id, user_id)
  on delete set null (project_id);

-- Only the application content named below is eligible for clearing. All
-- GitHub account records and cached activity remain available after clearing.
create or replace function public.clear_application_data(p_user_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  connections_before jsonb;
  intents_before jsonb;
  identities_before jsonb;
  account_before jsonb;
  repositories_before jsonb;
  events_before jsonb;
  activity_before jsonb;
begin
  if current_setting('request.jwt.claim.role', true) is distinct from 'service_role' then
    raise exception 'Forbidden' using errcode = '42501';
  end if;
  if p_user_id is null or not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'Invalid account' using errcode = '22023';
  end if;

  select coalesce(jsonb_agg(to_jsonb(c) order by c.id), '[]'::jsonb)
    into connections_before from public.github_connections c where c.user_id = p_user_id;
  select coalesce(jsonb_agg(to_jsonb(i) order by i.state), '[]'::jsonb)
    into intents_before from public.github_install_intents i where i.user_id = p_user_id;
  select coalesce(jsonb_agg(to_jsonb(i) order by i.id), '[]'::jsonb)
    into identities_before from auth.identities i where i.user_id = p_user_id;
  select to_jsonb(u) into account_before from auth.users u where u.id = p_user_id;
  select coalesce(jsonb_agg(to_jsonb(r) - 'project_id' order by r.id), '[]'::jsonb)
    into repositories_before from public.github_repositories r where r.user_id = p_user_id;
  select coalesce(jsonb_agg(to_jsonb(e) - 'project_id' order by e.id), '[]'::jsonb)
    into events_before from public.github_events e where e.user_id = p_user_id;
  select coalesce(jsonb_agg(to_jsonb(a) order by a.id), '[]'::jsonb)
    into activity_before from public.github_activity a where a.user_id = p_user_id;

  delete from public.invoice_notification_events where user_id = p_user_id;
  delete from public.invoice_line_items where user_id = p_user_id;
  delete from public.invoice_payments where user_id = p_user_id;
  update public.invoices set recurrence_id = null where user_id = p_user_id and recurrence_id is not null;
  delete from public.invoice_recurrences where user_id = p_user_id;
  delete from public.invoices where user_id = p_user_id;

  update public.transactions set recurring_occurrence_id = null
    where user_id = p_user_id and recurring_occurrence_id is not null;
  delete from public.recurring_occurrences where user_id = p_user_id;
  delete from public.recurring_schedules where user_id = p_user_id;
  delete from public.transactions where user_id = p_user_id;
  delete from public.financial_categories where user_id = p_user_id;

  delete from public.project_work_review_revisions where user_id = p_user_id;
  delete from public.project_work_reviews where user_id = p_user_id;
  delete from public.project_tasks where user_id = p_user_id;
  delete from public.project_notes where user_id = p_user_id;
  delete from public.project_links where user_id = p_user_id;
  delete from public.time_sessions where user_id = p_user_id;
  delete from public.projects where user_id = p_user_id;
  delete from public.client_category_assignments a
    using public.clients c where a.client_id = c.id and c.user_id = p_user_id;
  delete from public.clients where user_id = p_user_id;
  delete from public.client_categories where user_id = p_user_id;
  delete from public.goals where user_id = p_user_id;
  delete from public.habits where user_id = p_user_id;

  -- A mismatch aborts and rolls back the entire invocation. This catches a
  -- future FK or trigger change that touches account-level integration state.
  if connections_before is distinct from (
    select coalesce(jsonb_agg(to_jsonb(c) order by c.id), '[]'::jsonb)
    from public.github_connections c where c.user_id = p_user_id
  ) or intents_before is distinct from (
    select coalesce(jsonb_agg(to_jsonb(i) order by i.state), '[]'::jsonb)
    from public.github_install_intents i where i.user_id = p_user_id
  ) or identities_before is distinct from (
    select coalesce(jsonb_agg(to_jsonb(i) order by i.id), '[]'::jsonb)
    from auth.identities i where i.user_id = p_user_id
  ) or account_before is distinct from (
    select to_jsonb(u) from auth.users u where u.id = p_user_id
  ) or repositories_before is distinct from (
    select coalesce(jsonb_agg(to_jsonb(r) - 'project_id' order by r.id), '[]'::jsonb)
    from public.github_repositories r where r.user_id = p_user_id
  ) or events_before is distinct from (
    select coalesce(jsonb_agg(to_jsonb(e) - 'project_id' order by e.id), '[]'::jsonb)
    from public.github_events e where e.user_id = p_user_id
  ) or activity_before is distinct from (
    select coalesce(jsonb_agg(to_jsonb(a) order by a.id), '[]'::jsonb)
    from public.github_activity a where a.user_id = p_user_id
  ) then
    raise exception 'GitHub account state changed; clear rolled back' using errcode = '23514';
  end if;
end;
$$;
revoke all on function public.clear_application_data(uuid) from public, anon, authenticated;
grant execute on function public.clear_application_data(uuid) to service_role;
