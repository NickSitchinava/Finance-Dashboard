-- The installation setup redirect supplies the ID; user OAuth verifies ownership later.
alter table public.github_install_intents add column installation_id bigint;
