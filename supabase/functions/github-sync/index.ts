import {
  admin,
  cors,
  fail,
  github,
  installationToken,
  reply,
  saveEvents,
  type EventInput,
} from "../_shared/github.ts";

type Repo = {
  id: string;
  user_id: string;
  project_id: string;
  github_repository_id: number;
  connection_id: string;
  full_name: string;
  html_url: string;
  state: string;
};
const asDate = (value: unknown) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : null;
};
const validRange = (from: string, to: string) =>
  from <= to && to <= new Date().toISOString().slice(0, 10) &&
  Date.parse(to) - Date.parse(from) <= 366 * 86400000;
async function backfill(repo: Repo, installationId: number, from: string, to: string) {
  const token = await installationToken(installationId);
  const events: EventInput[] = [];
  let incomplete = false;
  const common = { user_id: repo.user_id, project_id: repo.project_id, repository_id: repo.id };
  for (let page = 1; page <= 10; page++) {
    const commits = (await github(
      `/repos/${repo.full_name}/commits?since=${from}T00%3A00%3A00Z&until=${to}T23%3A59%3A59Z&per_page=100&page=${page}`,
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
        source: "backfill",
      });
    if (commits.length < 100) break;
    if (page === 10) incomplete = true;
  }
  for (let page = 1; page <= 10; page++) {
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
      if (pr.created_at.slice(0, 10) >= from && pr.created_at.slice(0, 10) <= to)
        events.push({
          ...common,
          event_key: `pr:${pr.number}:opened`,
          kind: "pull_request",
          title: pr.title,
          html_url: pr.html_url,
          author_login: pr.user?.login ?? null,
          occurred_at: pr.created_at,
          source: "backfill",
        });
      if (pr.merged_at && pr.merged_at.slice(0, 10) >= from && pr.merged_at.slice(0, 10) <= to)
        events.push({
          ...common,
          event_key: `pr:${pr.number}:merged`,
          kind: "merge",
          title: pr.title,
          html_url: pr.html_url,
          author_login: pr.user?.login ?? null,
          occurred_at: pr.merged_at,
          source: "backfill",
        });
    }
    if (pulls.length < 100 || pulls.every((pr) => pr.updated_at.slice(0, 10) < from)) break;
    if (page === 10) incomplete = true;
  }
  const imported = await saveEvents(events);
  const { error } = await admin
    .from("github_repositories")
    .update({
      state: incomplete ? "delayed" : "connected",
      last_synced_at: new Date().toISOString(),
      checkpoint_at: `${to}T23:59:59Z`,
      last_error: incomplete
        ? "Historical import reached the 1,000-item page limit. Narrow the range and retry."
        : null,
    })
    .eq("id", repo.id);
  if (error) throw error;
  return { imported, incomplete };
}

async function finishConnection(userId: string, installationId: number, userToken: string) {
  const user = (await github("/user", userToken)) as { id: number; login: string };
  let installation: { id: number; account: { id: number; login: string } } | null = null;
  for (let page = 1; page <= 10 && !installation; page++) {
    const list = (await github(
      `/user/installations?per_page=100&page=${page}`,
      userToken,
    )) as { installations: Array<{ id: number; account: { id: number; login: string } }> };
    installation = list.installations.find((item) => item.id === installationId) ?? null;
    if (list.installations.length < 100) break;
  }
  if (!installation)
    return fail("This installation is not associated with your authorized GitHub account.", 403);
  const { data: existing, error: existingError } = await admin
    .from("github_connections")
    .select("user_id")
    .eq("installation_id", installationId)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing && existing.user_id !== userId)
    return fail("This GitHub installation is already connected to another F-Dash account.", 409);
  const connectionRecord = {
    user_id: userId,
    github_account_id: installation.account.id,
    github_login: installation.account.login || user.login,
    installation_id: installationId,
    state: "connected",
    updated_at: new Date().toISOString(),
  };
  const { error } = existing
    ? await admin.from("github_connections").update(connectionRecord)
      .eq("installation_id", installationId).eq("user_id", userId)
    : await admin.from("github_connections").insert(connectionRecord);
  if (error) throw error;
  return reply({ message: `Connected GitHub installation for ${installation.account.login}.` });
}

async function deviceRequest(url: string, parameters: Record<string, string>) {
  const response = await fetch(url, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(parameters),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(`GitHub device authorization returned HTTP ${response.status}: ${String(data.error ?? "unknown error")}`);
  return data;
}

async function handle(request: Request) {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return fail("Method not allowed.", 405);
  try {
    const authorization = request.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) return fail("Sign in first.", 401);
    const { data: auth, error: authError } = await admin.auth.getUser(authorization.slice(7));
    if (authError || !auth.user) return fail("Session expired. Sign in again.", 401);
    const userId = auth.user.id;
    const body = await request.json();
    const action = String(body.action ?? "");
    if (action === "install") {
      const slug = Deno.env.get("GITHUB_APP_SLUG");
      const missing = ["GITHUB_APP_SLUG", "GITHUB_APP_ID", "GITHUB_APP_PRIVATE_KEY", "GITHUB_APP_CLIENT_ID", "GITHUB_APP_CLIENT_SECRET"].filter((key) => !Deno.env.get(key));
      if (missing.length)
        return fail(
          `GitHub connection is not configured. Add these Supabase Edge Function secrets: ${missing.join(", ")}.`,
          503,
        );
      if (!slug) return fail("GitHub App slug is missing.", 503);
      const state = crypto.randomUUID() + crypto.randomUUID();
      const { error } = await admin
        .from("github_install_intents")
        .insert({
          state,
          user_id: userId,
          expires_at: new Date(Date.now() + 20 * 60_000).toISOString(),
        });
      if (error) throw error;
      return reply({
        url: `https://github.com/apps/${encodeURIComponent(slug)}/installations/new?state=${encodeURIComponent(state)}`,
      });
    }
    if (action === "authorize") {
      const state = String(body.state ?? "");
      const installationId = Number(body.installation_id);
      if (!state || !Number.isSafeInteger(installationId) || installationId <= 0)
        return fail("Incomplete GitHub installation response.");
      const { data: intent } = await admin
        .from("github_install_intents")
        .select("*")
        .eq("state", state)
        .eq("user_id", userId)
        .single();
      if (!intent || new Date(intent.expires_at).getTime() < Date.now())
        return fail("GitHub installation expired. Connect again.", 403);
      const { error } = await admin
        .from("github_install_intents")
        .update({ installation_id: installationId })
        .eq("state", state)
        .eq("user_id", userId);
      if (error) throw error;
      const clientId = Deno.env.get("GITHUB_APP_CLIENT_ID");
      if (!clientId) return fail("GitHub App client ID is missing.", 503);
      return reply({
        url: `https://github.com/login/oauth/authorize?client_id=${encodeURIComponent(clientId)}&state=${encodeURIComponent(state)}`,
      });
    }
    if (action === "device_start") {
      const clientId = Deno.env.get("GITHUB_APP_CLIENT_ID");
      if (!clientId) return fail("GitHub App client ID is missing.", 503);
      const now = new Date().toISOString();
      const { data: active, error: activeError } = await admin.from("github_install_intents")
        .select("state,user_code,expires_at,device_interval")
        .eq("user_id", userId).not("device_code", "is", null)
        .gt("expires_at", now).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (activeError) throw activeError;
      if (active)
        return reply({
          status: "awaiting_authorization", state: active.state, user_code: active.user_code,
          verification_uri: "https://github.com/login/device", interval: active.device_interval,
          expires_at: active.expires_at,
        });
      const { data: previous, error: previousError } = await admin.from("github_install_intents")
        .select("installation_id").eq("user_id", userId)
        .not("installation_id", "is", null)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (previousError) throw previousError;
      const installationId = Number(previous?.installation_id);
      if (!Number.isSafeInteger(installationId) || installationId <= 0)
        return fail("Install the GitHub App before using a device code.", 409);
      try {
        await installationToken(installationId);
      } catch {
        return fail("The previous GitHub App installation is unavailable. Install it again.", 409);
      }
      const device = await deviceRequest("https://github.com/login/device/code", { client_id: clientId });
      if (device.error === "device_flow_disabled")
        return fail("Device authorization is not enabled for this GitHub App.", 503);
      if (!device.device_code || !device.user_code || device.verification_uri !== "https://github.com/login/device")
        return fail("GitHub could not start device authorization. Please retry.", 502);
      const interval = Math.min(60, Math.max(1, Number(device.interval) || 5));
      const expiresAt = new Date(Date.now() + Math.min(900, Number(device.expires_in) || 900) * 1000).toISOString();
      const state = crypto.randomUUID() + crypto.randomUUID();
      const { error } = await admin.from("github_install_intents").insert({
        state, user_id: userId, installation_id: installationId, expires_at: expiresAt,
        device_code: device.device_code, user_code: device.user_code,
        device_interval: interval,
        device_poll_after: new Date(Date.now() + interval * 1000).toISOString(),
      });
      if (error) throw error;
      return reply({
        status: "awaiting_authorization", state, user_code: device.user_code,
        verification_uri: device.verification_uri, interval, expires_at: expiresAt,
      });
    }
    if (action === "device_poll") {
      const state = String(body.state ?? "");
      if (!state) return fail("Missing device authorization state.", 400);
      const { data: intent, error: intentError } = await admin.from("github_install_intents")
        .select("state,installation_id,device_code,device_interval,device_poll_after,expires_at")
        .eq("state", state).eq("user_id", userId).maybeSingle();
      if (intentError) throw intentError;
      if (!intent?.device_code || !Number.isSafeInteger(Number(intent.installation_id)))
        return fail("Device authorization is no longer available. Start again.", 410);
      if (new Date(intent.expires_at).getTime() <= Date.now()) {
        await admin.from("github_install_intents").delete().eq("state", state).eq("user_id", userId);
        return fail("GitHub device code expired. Start again.", 410);
      }
      const remaining = new Date(intent.device_poll_after).getTime() - Date.now();
      if (remaining > 0) return reply({ status: "pending", retry_after_ms: remaining });
      const interval = Number(intent.device_interval) || 5;
      const { data: claimed, error: claimError } = await admin.from("github_install_intents")
        .update({ device_poll_after: new Date(Date.now() + interval * 1000).toISOString() })
        .eq("state", state).eq("user_id", userId)
        .lte("device_poll_after", new Date().toISOString())
        .select("state").maybeSingle();
      if (claimError) throw claimError;
      if (!claimed) return reply({ status: "pending", retry_after_ms: interval * 1000 });
      const token = await deviceRequest("https://github.com/login/oauth/access_token", {
        client_id: Deno.env.get("GITHUB_APP_CLIENT_ID") ?? "",
        device_code: intent.device_code,
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      });
      if (token.error === "authorization_pending")
        return reply({ status: "pending", retry_after_ms: interval * 1000 });
      if (token.error === "slow_down") {
        const nextInterval = Math.min(60, Math.max(interval + 5, Number(token.interval) || 0));
        await admin.from("github_install_intents").update({
          device_interval: nextInterval,
          device_poll_after: new Date(Date.now() + nextInterval * 1000).toISOString(),
        }).eq("state", state).eq("user_id", userId);
        return reply({ status: "pending", retry_after_ms: nextInterval * 1000 });
      }
      if (!token.access_token) {
        await admin.from("github_install_intents").delete().eq("state", state).eq("user_id", userId);
        if (token.error === "access_denied") return fail("GitHub authorization was cancelled.", 403);
        if (token.error === "expired_token") return fail("GitHub device code expired. Start again.", 410);
        return fail("GitHub device authorization failed. Start again.", 403);
      }
      const { error: deleteError } = await admin.from("github_install_intents")
        .delete().eq("state", state).eq("user_id", userId);
      if (deleteError) throw deleteError;
      return await finishConnection(userId, Number(intent.installation_id), token.access_token);
    }
    if (action === "complete") {
      const state = String(body.state ?? "");
      const code = String(body.code ?? "");
      if (!state || !code) return fail("Incomplete GitHub authorization response.");
      const { data: intent, error: intentError } = await admin
        .from("github_install_intents")
        .select("*")
        .eq("state", state)
        .eq("user_id", userId)
        .single();
      if (
        intentError ||
        !intent ||
        !Number.isSafeInteger(Number(intent.installation_id)) ||
        Number(intent.installation_id) <= 0 ||
        new Date(intent.expires_at).getTime() < Date.now()
      )
        return fail("GitHub authorization expired. Connect again.", 403);
      const installationId = Number(intent.installation_id);
      const { data: claimed, error: claimError } = await admin.from("github_install_intents")
        .delete().eq("state", state).eq("user_id", userId).select("state").maybeSingle();
      if (claimError) throw claimError;
      if (!claimed) return fail("GitHub authorization was already used. Connect again.", 409);
      const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: Deno.env.get("GITHUB_APP_CLIENT_ID"),
          client_secret: Deno.env.get("GITHUB_APP_CLIENT_SECRET"),
          code,
        }),
      });
      const tokenData = await tokenResponse.json();
      if (!tokenResponse.ok || !tokenData.access_token)
        return fail("GitHub authorization could not be verified.", 403);
      return await finishConnection(userId, installationId, tokenData.access_token);
    }
    const { data: connections, error: connectionError } = await admin
      .from("github_connections")
      .select("*")
      .eq("user_id", userId);
    if (connectionError) throw connectionError;
    if (action === "repositories") {
      const repositories = [];
      for (const connection of connections ?? []) {
        if (connection.state !== "connected") continue;
        const token = await installationToken(connection.installation_id);
        for (let page = 1; page <= 10; page++) {
          const list = (await github(
            `/installation/repositories?per_page=100&page=${page}`,
            token,
          )) as { repositories: Array<{ id: number; full_name: string; html_url: string }> };
          repositories.push(
            ...list.repositories.map((repo) => ({
              ...repo,
              installation_id: connection.installation_id,
            })),
          );
          if (list.repositories.length < 100) break;
        }
      }
      return reply({ repositories });
    }
    if (action === "connect") {
      const installationId = Number(body.installation_id),
        repositoryId = Number(body.github_repository_id),
        projectId = String(body.project_id ?? "");
      const connection = (connections ?? []).find((c) => c.installation_id === installationId);
      if (!connection || connection.state !== "connected") return fail("GitHub installation needs reconnection.", 403);
      const { data: project } = await admin
        .from("projects")
        .select("id")
        .eq("id", projectId)
        .eq("user_id", userId)
        .single();
      if (!project) return fail("Project not found.", 404);
      const token = await installationToken(installationId);
      let repository: { id: number; full_name: string; html_url: string } | null = null;
      for (let page = 1; page <= 10 && !repository; page++) {
        const list = (await github(
          `/installation/repositories?per_page=100&page=${page}`,
          token,
        )) as { repositories: Array<{ id: number; full_name: string; html_url: string }> };
        repository = list.repositories.find((r) => r.id === repositoryId) ?? null;
        if (list.repositories.length < 100) break;
      }
      if (!repository)
        return fail("Repository is not available to this GitHub App installation.", 403);
      const from = asDate(body.from) ?? new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
      const to = asDate(body.to) ?? new Date().toISOString().slice(0, 10);
      if (!validRange(from, to)) return fail("Choose a valid range of up to 12 months.");
      const { data: mapped, error } = await admin
        .from("github_repositories")
        .upsert(
          {
            user_id: userId,
            connection_id: connection.id,
            project_id: projectId,
            github_repository_id: repository.id,
            full_name: repository.full_name,
            html_url: repository.html_url,
            state: "syncing",
          },
          { onConflict: "user_id,github_repository_id" },
        )
        .select("*")
        .single();
      if (error) throw error;
      try {
        const { error: remapError } = await admin
          .from("github_events")
          .update({ project_id: projectId })
          .eq("repository_id", mapped.id)
          .eq("user_id", userId);
        if (remapError) throw remapError;
        const result = await backfill(
          mapped,
          installationId,
          from,
          to,
        );
        return reply({
          message: `Connected ${repository.full_name}. Processed ${result.imported} events${result.incomplete ? "; import incomplete" : ""}.`,
        });
      } catch (error) {
        await admin
          .from("github_repositories")
          .update({ state: "error", last_error: String(error).slice(0, 250) })
          .eq("id", mapped.id);
        throw error;
      }
    }
    if (action === "disconnect" || action === "sync") {
      const { data: repo } = await admin
        .from("github_repositories")
        .select("*")
        .eq("id", String(body.repository_id ?? ""))
        .eq("user_id", userId)
        .single();
      if (!repo) return fail("Repository mapping not found.", 404);
      if (action === "disconnect") {
        const { error } = await admin.from("github_repositories").delete().eq("id", repo.id);
        if (error) throw error;
        return reply({ message: `Disconnected ${repo.full_name}.` });
      }
      const connection = (connections ?? []).find((c) => c.id === repo.connection_id);
      if (!connection || connection.state !== "connected") return fail("GitHub installation needs reconnection.", 409);
      const from =
        asDate(body.from) ?? new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
      const to = asDate(body.to) ?? new Date().toISOString().slice(0, 10);
      if (!validRange(from, to)) return fail("Choose a valid range of up to 12 months.");
      await admin.from("github_repositories").update({ state: "syncing" }).eq("id", repo.id);
      try {
        const result = await backfill(repo, connection.installation_id, from, to);
        return reply({
          message: `Processed ${result.imported} events${result.incomplete ? "; import incomplete, narrow the range and retry" : ""}.`,
        });
      } catch (error) {
        await admin
          .from("github_repositories")
          .update({ state: "error", last_error: String(error).slice(0, 250) })
          .eq("id", repo.id);
        throw error;
      }
    }
    return fail("Unknown GitHub action.");
  } catch (error) {
    console.error("github-sync failed", error instanceof Error ? error.message : "unknown");
    return fail(error instanceof Error ? error.message : "GitHub sync failed.", 500);
  }
}

Deno.serve(async (request) => {
  const response = await handle(request);
  const origin = request.headers.get("Origin");
  if (origin && [Deno.env.get("FDASH_APP_ORIGIN"), Deno.env.get("FDASH_DEV_ORIGIN")].includes(origin))
    response.headers.set("Access-Control-Allow-Origin", origin);
  return response;
});
