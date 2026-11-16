-- A client profile can be removed without deleting its projects and their records.
alter table public.projects
  drop constraint projects_client_id_fkey;

alter table public.projects
  add constraint projects_client_id_fkey
  foreign key (client_id) references public.clients(id) on delete set null;

-- Keep the delete behind an RPC so the UI cannot use the old cascading FK
-- if the frontend is released before this migration reaches the database.
create function public.delete_client(p_client_id uuid)
returns boolean
language plpgsql security invoker set search_path = public, pg_temp as $$
begin
  delete from public.clients
  where id = p_client_id and user_id = auth.uid();
  return found;
end;
$$;

revoke all on function public.delete_client(uuid) from public, anon;
grant execute on function public.delete_client(uuid) to authenticated;
