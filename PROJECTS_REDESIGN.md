# Projects workspace delivery

## Implemented

- Client and personal project views share the existing `projects` table. Existing projects are classified from their client relationship. Project IDs and legacy fields remain intact.
- Grid and table browse the same project records. Search, status, deadline, repository, and sort controls apply to both. Selecting a project opens one centered portal workspace on desktop, with a card-to-dialog transition when the source remains visible; mobile uses a full-screen workspace with browser back support. The backdrop closes on click, Escape closes the workspace, focus returns to the source, and unsaved form drafts are guarded.
- Project forms support optional client, dates, planned weeks, financial terms, and links. Tasks, notes, and references persist in Supabase. Progress is calculated only from tasks.
- Project finances read the existing transaction ledger by `project_id`. Each currency is displayed separately. Outstanding amounts compare an agreed amount only with recorded income in the same currency. No estimated cost is treated as an actual expense.
- Renew Time reviews one Monday–Sunday period at a time. A unique database key prevents duplicates. Corrections update that period and write an audit revision. GitHub activity never changes confirmed time automatically.
- GitHub event tables are separate from `github_activity`; the 33 existing manual records remain untouched and do not appear in the verified activity feed.
- Edge Functions for authenticated GitHub setup/sync, signed webhooks, and scheduled reconciliation are deployed. GitHub rows publish owner-scoped Realtime updates, with a five-minute refresh fallback. The workflow for the six-hour reconciliation schedule is in `.github/workflows/github-reconcile.yml`.

## GitHub App setup required

The integration cannot ingest events until a GitHub App is registered and its credentials are configured. The Codex GitHub connection is separate from F-Dash's own GitHub App.

1. Create a GitHub App. Set its **Setup URL** and **first Callback URL** to `https://f-dash.vercel.app/projects`. Leave **Request user authorization during installation** off; F-Dash starts the user authorization flow after receiving the installation setup redirect.
2. Use repository permissions **Contents: Read-only**, **Pull requests: Read-only**, and **Metadata: Read-only**. Subscribe to **Push**, **Pull request**, **Installation**, and **Repository** webhook events. Set the webhook URL to `https://pdifdrvgjbxplsbkrruu.supabase.co/functions/v1/github-webhook` and choose a random webhook secret.
3. In Supabase Edge Function secrets, set `GITHUB_APP_SLUG`, `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_APP_CLIENT_ID`, `GITHUB_APP_CLIENT_SECRET`, `GITHUB_WEBHOOK_SECRET`, and `GITHUB_RECONCILE_SECRET`. Keep the private key and secrets server-side. `FDASH_APP_ORIGIN=https://f-dash.vercel.app` is optional but recommended for CORS restriction.
4. Add the same reconciliation value as a GitHub Actions repository secret named `FDASH_RECONCILE_SECRET` (GitHub reserves the `GITHUB_` prefix). Commit and push the workflow to enable six-hour reconciliation.
5. Open F-Dash, click **Connect GitHub**, install the App, authorize it, then choose which repositories map to which F-Dash projects. Choose 30 days, 90 days, six months, twelve months, or a custom range for initial or later import.
6. Send a test webhook delivery, then confirm it appears in `github_events` and the Projects feed. Until that succeeds, treat the connection as setup-dependent.

The webhook checks `X-Hub-Signature-256` against the raw body and only accepts mapped repository IDs under a verified installation. Stable keys deduplicate commit, PR-open, and PR-merge events. Historical imports and reconciliation reuse those keys. A 1,000-item per endpoint page cap marks an import incomplete and asks for a narrower range. Empty repositories are supported.

Reassigning a repository to another project moves its existing verified events to that project. A failed initial import marks the mapping as errored so it can be retried from the project workspace.

## Renew Time estimate

The first version uses distinct days with verified activity in a selected week. Fewer than two active days produce **Insufficient activity**. Otherwise each active day supports a conservative two-hour estimate, capped at 16 hours for the week, divided by the configured standard working-week hours (default 40, allowed 10–80). This is a prompt for review, not an observation of actual work. The user accepts it or enters the actual weeks manually. The review stores both values, method, version, standard-week hours, period, and confirmation timestamp.

## Known limits

- GitHub App credentials and authorization are not configured or tested yet. The deployed functions are protected but synchronization is not operational until setup completes.
- The GitHub reconciliation workflow becomes active only after the workflow is pushed and its secret is set.
- The Projects page loads up to 10,000 verified events from the previous 91 days in pages of 1,000 for project feeds. A separate authenticated, owner-scoped SQL function aggregates a full year of verified events by local date for the Development activity calendar, so the year-wide heatmap does not download every historical event. Its seven-day week columns use a five-level Persian intensity scale. Older backfill remains in Supabase.
- Existing `github_activity` rows are preserved for audit but not shown as verified events.
- The UI has no screenshot-based acceptance run because the local app requires a test account login. Build, focused lint, unit tests, database queries, and unauthenticated endpoint rejection checks were run.
