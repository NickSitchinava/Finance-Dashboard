-- Installation handshakes are server-only. The OAuth state is short-lived and single-use.
create table public.github_install_intents (
  state text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index github_install_intents_expiry_idx on public.github_install_intents(expires_at);
alter table public.github_install_intents enable row level security;
revoke all on public.github_install_intents from anon, authenticated;

create schema if not exists fdash_private;
revoke all on schema fdash_private from public;
create or replace function fdash_private.record_work_review_revision()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.confirmed_weeks is distinct from new.confirmed_weeks then
    insert into public.project_work_review_revisions(review_id,user_id,previous_weeks,revised_weeks)
    values (old.id,old.user_id,old.confirmed_weeks,new.confirmed_weeks);
  end if;
  return new;
end;
$$;
revoke all on function fdash_private.record_work_review_revision() from public, anon, authenticated;
create trigger project_work_review_revision
after update on public.project_work_reviews
for each row execute function fdash_private.record_work_review_revision();
