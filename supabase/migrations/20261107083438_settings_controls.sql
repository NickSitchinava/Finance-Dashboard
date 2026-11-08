-- Currency stays a display preference; recorded amounts and original currencies are untouched.
alter table public.profiles
  add column if not exists preferred_currency text;
alter table public.profiles
  add constraint profiles_preferred_currency_check
  check (preferred_currency is null or preferred_currency in ('USD', 'EUR', 'GEL')) not valid;

-- The existing public avatar bucket uses avatars/<user-id>.<extension>.
update storage.buckets set file_size_limit = 2097152,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
  where id = 'avatars';
create policy "Owners read avatar files" on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and name ~ ('^avatars/' || (select auth.uid())::text || '\.(jpg|png|webp)$'));
create policy "Owners upload avatar files" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and name ~ ('^avatars/' || (select auth.uid())::text || '\.(jpg|png|webp)$'));
create policy "Owners replace avatar files" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and name ~ ('^avatars/' || (select auth.uid())::text || '\.(jpg|png|webp)$'))
  with check (bucket_id = 'avatars' and name ~ ('^avatars/' || (select auth.uid())::text || '\.(jpg|png|webp)$'));
create policy "Owners remove avatar files" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and name ~ ('^avatars/' || (select auth.uid())::text || '\.(jpg|png|webp)$'));

-- This RPC is callable only with the service role from the password-verifying Edge Function.
-- A single invocation is one PostgreSQL transaction. GitHub account credentials and profile
-- identity are intentionally preserved. No application-owned Storage objects exist today.
create or replace function public.clear_application_data(p_user_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if current_setting('request.jwt.claim.role', true) is distinct from 'service_role' then
    raise exception 'Forbidden' using errcode = '42501';
  end if;
  if p_user_id is null or not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'Invalid account' using errcode = '22023';
  end if;

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
  delete from public.github_events where user_id = p_user_id;
  delete from public.github_repositories where user_id = p_user_id;
  delete from public.projects where user_id = p_user_id;
  delete from public.client_category_assignments a
    using public.clients c where a.client_id = c.id and c.user_id = p_user_id;
  delete from public.clients where user_id = p_user_id;
  delete from public.client_categories where user_id = p_user_id;
  delete from public.goals where user_id = p_user_id;
  delete from public.habits where user_id = p_user_id;
  delete from public.github_activity where user_id = p_user_id;
end;
$$;
revoke all on function public.clear_application_data(uuid) from public, anon, authenticated;
grant execute on function public.clear_application_data(uuid) to service_role;
