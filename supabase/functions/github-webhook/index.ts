import {
  admin,
  fail,
  reply,
  saveEvents,
  verifySignature,
  type EventInput,
} from "../_shared/github.ts";

Deno.serve(async (request) => {
  if (request.method !== "POST") return fail("Method not allowed.", 405);
  const raw = await request.text();
  if (!(await verifySignature(raw, request.headers.get("X-Hub-Signature-256"))))
    return fail("Invalid GitHub signature.", 401);
  try {
    const payload = JSON.parse(raw);
    const type = request.headers.get("X-GitHub-Event");
    const installationId = Number(payload.installation?.id);
    const githubRepositoryId = Number(payload.repository?.id);
    if (!Number.isSafeInteger(installationId) || installationId <= 0)
      return fail("Missing installation ID.");
    if (type === "installation" && payload.action === "deleted") {
      const { error } = await admin
        .from("github_connections")
        .update({ state: "reauthorization_required", updated_at: new Date().toISOString() })
        .eq("installation_id", installationId);
      if (error) throw error;
      return reply({ accepted: true });
    }
    if (type === "installation_repositories" && payload.action === "removed") {
      const ids = (payload.repositories_removed ?? []).map((repo: { id: number }) => repo.id)
        .filter((id: number) => Number.isSafeInteger(id));
      if (ids.length) {
        const { data: connection, error: connectionError } = await admin
          .from("github_connections").select("id").eq("installation_id", installationId).maybeSingle();
        if (connectionError) throw connectionError;
        if (connection) {
          const { error } = await admin.from("github_repositories")
            .update({ state: "reauthorization_required", last_error: "Repository access was removed from the GitHub App installation." })
            .eq("connection_id", connection.id).in("github_repository_id", ids);
          if (error) throw error;
        }
      }
      return reply({ accepted: true });
    }
    if (!Number.isSafeInteger(githubRepositoryId)) return reply({ ignored: true });
    const { data: connection, error: connectionError } = await admin
      .from("github_connections")
      .select("id,user_id,state")
      .eq("installation_id", installationId)
      .maybeSingle();
    if (connectionError) throw connectionError;
    if (!connection || connection.state !== "connected") return reply({ ignored: true });
    const { data: repo, error: repoError } = await admin
      .from("github_repositories")
      .select("*")
      .eq("connection_id", connection.id)
      .eq("github_repository_id", githubRepositoryId)
      .eq("user_id", connection.user_id)
      .maybeSingle();
    if (repoError) throw repoError;
    if (!repo) return reply({ ignored: true });
    if (repo.state === "reauthorization_required") return reply({ ignored: true });
    if (type === "repository" && payload.action === "deleted") {
      const { error } = await admin.from("github_repositories")
        .update({ state: "reauthorization_required", last_error: "Repository was deleted on GitHub." })
        .eq("id", repo.id);
      if (error) throw error;
      return reply({ accepted: true });
    }
    if (payload.repository?.full_name && payload.repository.full_name !== repo.full_name) {
      const { error } = await admin
        .from("github_repositories")
        .update({ full_name: payload.repository.full_name, html_url: payload.repository.html_url })
        .eq("id", repo.id);
      if (error) throw error;
    }
    const common = {
      user_id: repo.user_id,
      project_id: repo.project_id,
      repository_id: repo.id,
      source: "webhook" as const,
    };
    const events: EventInput[] = [];
    if (type === "push" && !payload.deleted) {
      for (const commit of payload.commits ?? [])
        if (commit.id && commit.timestamp)
          events.push({
            ...common,
            event_key: `commit:${commit.id}`,
            kind: "commit",
            title: String(commit.message ?? "")
              .split("\n")[0]
              .slice(0, 300),
            html_url: commit.url || `${repo.html_url}/commit/${commit.id}`,
            author_login: commit.author?.username ?? commit.author?.name ?? null,
            occurred_at: commit.timestamp,
          });
    } else if (type === "pull_request" && payload.pull_request?.number) {
      const pr = payload.pull_request;
      if (payload.action === "opened")
        events.push({
          ...common,
          event_key: `pr:${pr.number}:opened`,
          kind: "pull_request",
          title: pr.title,
          html_url: pr.html_url,
          author_login: pr.user?.login ?? null,
          occurred_at: pr.created_at,
        });
      if (payload.action === "closed" && pr.merged_at)
        events.push({
          ...common,
          event_key: `pr:${pr.number}:merged`,
          kind: "merge",
          title: pr.title,
          html_url: pr.html_url,
          author_login: pr.merged_by?.login ?? pr.user?.login ?? null,
          occurred_at: pr.merged_at,
        });
    }
    const saved = await saveEvents(events);
    return reply({ accepted: true, saved });
  } catch (error) {
    console.error("github-webhook failed", error instanceof Error ? error.message : "unknown");
    return fail("Webhook processing failed.", 500);
  }
});
