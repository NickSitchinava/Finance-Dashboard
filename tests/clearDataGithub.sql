-- Run as a single SQL request against an isolated test database or in a
-- transaction on the live database. The synthetic account is rolled back.
begin;

-- Secret service keys authorize the service_role database role without
-- populating the legacy request.jwt.claim.role setting.

do $$
declare
  test_user uuid := gen_random_uuid();
  test_project uuid;
  test_connection uuid;
  test_repository uuid;
  test_installation bigint := -floor(extract(epoch from clock_timestamp()) * 1000)::bigint;
begin
  insert into auth.users (id, email, aud, role, created_at, updated_at)
    values (test_user, 'clear-data-github-test-' || test_user || '@example.invalid',
      'authenticated', 'authenticated', now(), now());
  insert into auth.identities (provider_id, user_id, identity_data, provider)
    values (test_user::text, test_user,
      jsonb_build_object('sub', test_user::text), 'github');
  insert into public.github_connections
    (user_id, github_account_id, github_login, installation_id, state)
    values (test_user, -1, 'synthetic-test-account', test_installation, 'connected')
    returning id into test_connection;
  insert into public.projects (user_id, name)
    values (test_user, 'Disposable clear test') returning id into test_project;
  insert into public.github_repositories
    (user_id, connection_id, project_id, github_repository_id, full_name, html_url)
    values (test_user, test_connection, test_project, -1,
      'synthetic-test-account/repository', 'https://github.com/synthetic-test-account/repository')
    returning id into test_repository;
  insert into public.github_events
    (user_id, project_id, repository_id, event_key, kind, title, html_url, occurred_at, source)
    values (test_user, test_project, test_repository, 'commit:synthetic', 'commit',
      'Synthetic commit', 'https://github.com/synthetic-test-account/repository/commit/synthetic',
      now(), 'backfill');
  insert into public.github_activity (user_id, repository, type, date)
    values (test_user, 'synthetic-test-account/repository', 'commit', current_date);

  perform public.clear_application_data(test_user);

  if not exists (select 1 from auth.users where id = test_user)
    or not exists (select 1 from auth.identities where user_id = test_user and provider = 'github')
    or not exists (select 1 from public.github_connections
      where id = test_connection and user_id = test_user and installation_id = test_installation
        and state = 'connected')
    or exists (select 1 from public.projects where user_id = test_user)
    or not exists (select 1 from public.github_repositories
      where id = test_repository and user_id = test_user and connection_id = test_connection
        and project_id is null and state = 'connected')
    or not exists (select 1 from public.github_events
      where user_id = test_user and repository_id = test_repository and project_id is null)
    or not exists (select 1 from public.github_activity where user_id = test_user)
  then
    raise exception 'Clear Data GitHub preservation regression failed';
  end if;

  -- Relinking the same GitHub repository to a new F-Dash project must work.
  insert into public.projects (user_id, name)
    values (test_user, 'Relinked project') returning id into test_project;
  update public.github_repositories set project_id = test_project where id = test_repository;
  update public.github_events set project_id = test_project where repository_id = test_repository;
  if not exists (select 1 from public.github_repositories
    where id = test_repository and project_id = test_project)
    or not exists (select 1 from public.github_events
      where repository_id = test_repository and project_id = test_project)
  then
    raise exception 'GitHub repository relink regression failed';
  end if;

  perform public.clear_application_data(test_user);
  if exists (select 1 from public.projects where user_id = test_user)
    or not exists (select 1 from public.github_repositories
      where id = test_repository and project_id is null)
    or not exists (select 1 from public.github_events
      where repository_id = test_repository and project_id is null)
  then
    raise exception 'Repeated Clear Data GitHub preservation regression failed';
  end if;
end;
$$;

rollback;
select 'synthetic GitHub preservation test passed; all test rows rolled back' as result;
