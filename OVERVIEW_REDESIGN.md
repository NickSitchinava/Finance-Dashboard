# F-Dash Overview design and data contract

## Current layout

Overview uses Ghost (`#F7F7FF`) and Persian (`#27187E`) with a compact, aligned card grid. The shared TopBar receives a light style only on `/`, and its right action area contains the Overview customization control. The Overview body has no duplicate title, date, or greeting. The sidebar and all other page styles remain unchanged.

Six KPI cards show recorded revenue, net cash flow, total active client records, total project records, active projects, and outstanding invoice value. The lower grid contains Financial Performance, Needs Attention, Active Projects, Daily Briefing, and Recent Transactions. The timer has been removed from Overview; its existing database records and RPC remain untouched. Business widgets are read-only.

Widget order and visibility are stored in `overview_preferences`. Existing saved layouts are normalized: the old timer entry is ignored, and Recent Transactions is added to layouts that predate it. Save persists the draft. Cancel restores the previous saved layout. Mobile uses button-based reordering, so page scrolling does not compete with dragging.

## Metric definitions

- Recorded revenue and expenses come from the `overview_financial_summary` RPC, which aggregates the authenticated user's transaction rows. Revenue excludes unpaid invoices.
- Net cash flow is recorded income less recorded expenses.
- Total Clients counts active records in `clients`, matching the existing Clients page's `active = true` filter.
- Total Projects counts all the user's `projects` records, including completed and planned work.
- Active Projects counts statuses `In Progress`, `Review`, and `Overdue`. Completed, Coming Soon, and Paused are excluded. Four project previews are shown.
- Outstanding Invoices sums invoice face values where status is not Paid, matching the Invoices page.
- Needs Attention uses project deadlines, unpaid invoice due dates, and incomplete goal target dates within 14 days or overdue. Dates are compared as local calendar days. The card shows the first five in deadline order and reports the full count.
- Recent Transactions shows the latest three transaction records. Missing descriptions get a label derived from the actual transaction type.

The financial chart offers 30d, 3m, 6m, and 12m. `30d` is the rolling 30 days, grouped into five-day bins. `3m`, `6m`, and `12m` include the current calendar month and the preceding 2, 5, or 11 full month buckets. The previous-period comparison covers the equivalent preceding interval. Switching metric or period keeps the panel fade and uses Recharts' built-in area morph; the first appearance uses its line reveal. Reduced-motion users get an immediate update.

## Database and verification

The previously applied additive migrations remain in `supabase/migrations/`. `overview_preferences` stores layout choices. `time_sessions` and its RPC retain any existing time records even though the Overview timer UI is gone. `overview_financial_summary` is a security-invoker RPC and aggregates only rows owned by the authenticated user. The two new counts also filter by `user_id`, while RLS remains in force.

`npm run build` succeeds. `npx eslint src/pages/OverviewPage.tsx` succeeds. Full repository lint still reports pre-existing errors across shared and unrelated components, including a TopBar notification effect that was present before this refinement. The local page could not be opened by the available browser control, so interactive desktop/mobile screenshot verification remains outstanding.
