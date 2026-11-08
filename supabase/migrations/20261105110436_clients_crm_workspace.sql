alter table public.clients
  add column if not exists relationship_stage text,
  add column if not exists sort_order integer,
  add column if not exists company text,
  add column if not exists website text,
  add column if not exists lead_source text,
  add column if not exists notes_blocks jsonb,
  add column if not exists follow_up_at timestamptz,
  add column if not exists follow_up_note text,
  add column if not exists follow_up_priority text,
  add column if not exists follow_up_completed boolean not null default false,
  add column if not exists board_updated_at timestamptz not null default now();

update public.clients
set relationship_stage = case when active is false then 'archived' else 'active' end
where relationship_stage is null;

alter table public.clients alter column relationship_stage set default 'active';
alter table public.clients alter column relationship_stage set not null;
alter table public.clients add constraint clients_relationship_stage_check
  check (relationship_stage in ('active','completed','archived','lead','contacted','negotiating'));
alter table public.clients add constraint clients_notes_blocks_check
  check (notes_blocks is null or jsonb_typeof(notes_blocks) = 'array');
alter table public.clients add constraint clients_follow_up_priority_check
  check (follow_up_priority is null or follow_up_priority in ('low','normal','high'));

with numbered as (
  select id, row_number() over (partition by user_id, relationship_stage order by name, id) - 1 as position
  from public.clients
)
update public.clients c set sort_order = numbered.position
from numbered where numbered.id = c.id and c.sort_order is null;

create index if not exists clients_board_order_idx
  on public.clients (user_id, relationship_stage, sort_order);
create index if not exists clients_follow_up_idx
  on public.clients (user_id, follow_up_at) where follow_up_at is not null and follow_up_completed = false;

create or replace function public.save_client_board(p_changes jsonb)
returns void language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  item jsonb;
  owner_id uuid := auth.uid();
  client_id uuid;
  stage text;
  position integer;
  expected_at timestamptz;
  seen_ids uuid[] := '{}';
begin
  if owner_id is null then raise exception 'Authentication required'; end if;
  if jsonb_typeof(p_changes) <> 'array' then raise exception 'Changes must be an array'; end if;
  for item in select value from jsonb_array_elements(p_changes) loop
    client_id := (item->>'id')::uuid;
    stage := item->>'stage';
    position := (item->>'sort_order')::integer;
    expected_at := (item->>'board_updated_at')::timestamptz;
    if client_id = any(seen_ids) then raise exception 'Duplicate client in changes'; end if;
    seen_ids := array_append(seen_ids, client_id);
    if stage not in ('active','completed','archived','lead','contacted','negotiating') or position < 0 then
      raise exception 'Invalid board placement';
    end if;
    update public.clients
    set relationship_stage = stage, sort_order = position,
        active = (stage <> 'archived'), board_updated_at = now()
    where id = client_id and user_id = owner_id and board_updated_at = expected_at;
    if not found then raise exception 'Client board changed elsewhere. Refresh before saving.'; end if;
  end loop;
end;
$$;

revoke all on function public.save_client_board(jsonb) from public, anon;
grant execute on function public.save_client_board(jsonb) to authenticated;
