# Goals workspace migration

Applied to F-Dash on 2026-11-06. The approved reset affected only `public.goals` (25 rows) and `public.milestones` (4 rows). Before the reset, the dependency audit found no incoming foreign keys, dependent views, application notification references, custom triggers, or database functions referencing either table. The old Goals and Milestones UI components were removed; the sidebar and global notification shell remain.

## Recovery

The migration copied the original rows to `private.goals_backup_20261106` and `private.milestones_backup_20261106` before deleting any records. These private tables are not exposed to `anon` or `authenticated`. Their verified counts are 25 and 4. To recover, use a database administrator session to inspect those copies and insert the desired rows into a compatible schema. The old goal table shape is preserved in the backup. The old milestones table must be recreated from its backup shape if that legacy feature is deliberately restored.

## New schema

- `public.goals`: one user's top-level goals, status, priority, horizon, manual progress, recurrence schedule, notes, and links.
- `public.goal_steps`: a single level of checklist items or subgoals. The compound foreign key requires the same owner as the parent.
- `public.goal_progress_events`: actual progress changes recorded from this release forward. No earlier progress history was invented.
- `public.goal_occurrences`: one row per goal and scheduled local date. The unique key prevents duplicate reminders.

All four public tables have RLS. Authenticated users can access their own rows. The occurrence table grants clients updates only to `status` and `resolved_at`; scheduling and ownership are server controlled. `public.process_goal_occurrences()` runs through the existing Supabase Cron facility every 15 minutes. It interprets each goal's IANA time zone, catches up dates missed by scheduler downtime, creates due occurrences, and marks pending occurrences missed once their local date passes. A trigger removes stale pending occurrences when a schedule changes while preserving resolved history.

## Verification

- The live Goals table contains zero rows following the reset.
- Backup counts are 25 goals and 4 milestones.
- The existing Projects, Clients, and Invoices tables retained their rows (7, 10, and 1 at verification).
- A signed-in role inserted and read its own goal inside a rolled-back transaction.
- A recurring goal generated an occurrence and a schedule change cleared the pending occurrence inside a rolled-back transaction.
- A three-day scheduler catch-up produced three missed occurrences and one pending occurrence inside a rolled-back transaction.
- A second signed-in user could not read a goal created by another user inside a rolled-back transaction.
- Live UI checks created and deleted a one-time goal, generated a due recurring notification, answered Yes in the existing bell, and observed the streak rise to one. The temporary test records were removed; live Goals, steps, occurrences, and progress events all returned to zero rows.
- Supabase security advisors reported no new Goals findings. Existing findings in unrelated modules were left untouched.
