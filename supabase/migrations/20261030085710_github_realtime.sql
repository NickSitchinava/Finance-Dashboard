-- Browser subscribers still obey RLS; only owner-readable rows are delivered.
alter publication supabase_realtime add table public.github_events;
alter publication supabase_realtime add table public.github_repositories;
