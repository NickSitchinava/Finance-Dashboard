-- A reminder response may change its state, never its owner or schedule.
revoke update on public.goal_occurrences from authenticated;
grant update(status,resolved_at) on public.goal_occurrences to authenticated;
