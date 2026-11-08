-- Device authorization is bound to a short-lived, server-only installation intent.
alter table public.github_install_intents
  add column device_code text,
  add column user_code text,
  add column device_poll_after timestamptz,
  add column device_interval integer;

alter table public.github_install_intents
  add constraint github_install_intents_device_interval_check
  check (device_interval is null or device_interval between 1 and 60);
