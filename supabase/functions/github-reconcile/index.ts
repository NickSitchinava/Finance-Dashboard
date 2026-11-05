import {
  admin,
  fail,
  github,
  installationToken,
  reply,
  saveEvents,
  type EventInput,
} from "../_shared/github.ts";

// Call on a schedule with a secret header after the GitHub App is configured.
// Re-reading the last seven days covers delayed and missed deliveries; event keys deduplicate.
Deno.serve(async (request) => {
  if (request.method !== "POST") return fail("Method not allowed.", 405);
  const expected = Deno.env.get("GITHUB_RECONCILE_SECRET");
  const supplied = request.headers.get("x-reconcile-secret");
  if (!expected || !supplied || expected.length !== supplied.length)
    return fail("Unauthorized.", 401);
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ supplied.charCodeAt(i);
  if (diff !== 0) return fail("Unauthorized.", 401);
  try {
    const { data: repos, error } = await admin
      .from("github_repositories")
      .select("*,github_connections!inner(installation_id,state)")
      .in("state", ["connected", "delayed", "error"]);
    if (error) throw error;
    let updated = 0,
      failed = 0;
    for (const repo of repos ?? []) {
      if (repo.github_connections?.state !== "connected") continue;
      try {
        const token = await installationToken(repo.github_connections.installation_id);
        const from = new Date(Date.now() - 7 * 86400000).toISOString();
        const common = {
          user_id: repo.user_id,
          project_id: repo.project_id,
          repository_id: repo.id,
          source: "reconcile" as const,
        };
        const events: EventInput[] = [];
        for (let page = 1; page <= 5; page++) {
          const commits = (await github(
            `/repos/${repo.full_name}/commits?since=${encodeURIComponent(from)}&per_page=100&page=${page}`,
            token,
          )) as Array<{
            sha: string;
            commit: { message: string; author: { date: string; name: string } };
            html_url: string;
            author?: { login: string };
          }>;
          for (const item of commits)
            events.push({
              ...common,
              event_key: `commit:${item.sha}`,
              kind: "commit",
              title: item.commit.message.split("\n")[0].slice(0, 300),
              html_url: item.html_url,
              author_login: item.author?.login ?? item.commit.author?.name ?? null,
              occurred_at: item.commit.author.date,
            });
          if (commits.length < 100) break;
        }
        for (let page = 1; page <= 5; page++) {
          const pulls = (await github(
            `/repos/${repo.full_name}/pulls?state=all&sort=updated&direction=desc&per_page=100&page=${page}`,
            token,
          )) as Array<{
            number: number;
            title: string;
            html_url: string;
            created_at: string;
            updated_at: string;
            merged_at: string | null;
            user?: { login: string };
          }>;
          for (const pr of pulls) {
            if (pr.created_at >= from)
              events.push({
                ...common,
                event_key: `pr:${pr.number}:opened`,
                kind: "pull_request",
                title: pr.title,
                html_url: pr.html_url,
                author_login: pr.user?.login ?? null,
                occurred_at: pr.created_at,
              });
            if (pr.merged_at && pr.merged_at >= from)
              events.push({
                ...common,
                event_key: `pr:${pr.number}:merged`,
                kind: "merge",
                title: pr.title,
                html_url: pr.html_url,
                author_login: pr.user?.login ?? null,
                occurred_at: pr.merged_at,
              });
          }
          if (pulls.length < 100 || pulls.every((pr) => pr.updated_at < from)) break;
        }
        await saveEvents(events);
        await admin
          .from("github_repositories")
          .update({
            state: "connected",
            last_synced_at: new Date().toISOString(),
            checkpoint_at: new Date().toISOString(),
            last_error: null,
          })
          .eq("id", repo.id);
        updated++;
      } catch (error) {
        failed++;
        await admin
          .from("github_repositories")
          .update({
            state: "error",
            last_error:
              error instanceof Error ? error.message.slice(0, 250) : "Reconciliation failed",
          })
          .eq("id", repo.id);
      }
    }
    return reply({ updated, failed });
  } catch (error) {
    console.error("github-reconcile failed", error instanceof Error ? error.message : "unknown");
    return fail("Reconciliation failed.", 500);
  }
});
