alter table public.project_work_review_revisions
add column previous_confirmed_at timestamptz,
add column previous_method text,
add column previous_estimate numeric(8,3);

create or replace function fdash_private.record_work_review_revision()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.confirmed_weeks is distinct from new.confirmed_weeks
     or old.confirmation_method is distinct from new.confirmation_method then
    insert into public.project_work_review_revisions
      (review_id,user_id,previous_weeks,revised_weeks,previous_confirmed_at,previous_method,previous_estimate)
    values
      (old.id,old.user_id,old.confirmed_weeks,new.confirmed_weeks,old.confirmed_at,old.confirmation_method,old.estimated_weeks);
  end if;
  return new;
end;
$$;
revoke all on function fdash_private.record_work_review_revision() from public, anon, authenticated;
