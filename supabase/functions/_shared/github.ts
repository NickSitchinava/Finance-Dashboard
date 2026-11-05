import { createClient } from "npm:@supabase/supabase-js@2.99.0";
import { pkcs1ToPkcs8 } from "./pem.ts";

export const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);
export const cors = {
  "Access-Control-Allow-Origin": Deno.env.get("FDASH_APP_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};
export const reply = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), { status, headers: cors });
export const fail = (message: string, status = 400) => reply({ error: message }, status);

const b64 = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
const encoder = new TextEncoder();
export async function appJwt() {
  const pem = Deno.env.get("GITHUB_APP_PRIVATE_KEY")?.replace(/\\n/g, "\n");
  const appId = Deno.env.get("GITHUB_APP_ID");
  if (!pem || !appId) throw new Error("GitHub App is not configured.");
  const raw = Uint8Array.from(atob(pem.replace(/-----[^-]+-----/g, "").replace(/\s/g, "")), (c) =>
    c.charCodeAt(0),
  );
  const keyBytes = pem.includes("BEGIN RSA PRIVATE KEY") ? pkcs1ToPkcs8(raw) : raw;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    keyBytes,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const now = Math.floor(Date.now() / 1000);
  const part = `${b64(encoder.encode(JSON.stringify({ alg: "RS256", typ: "JWT" })))}.${b64(encoder.encode(JSON.stringify({ iat: now - 60, exp: now + 540, iss: appId })))}`;
  const signature = new Uint8Array(
    await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, encoder.encode(part)),
  );
  return `${part}.${b64(signature)}`;
}
export async function github(path: string, token: string, init: RequestInit = {}) {
  const response = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2026-03-10",
      ...init.headers,
    },
  });
  if (response.status === 409 && path.includes("/commits?")) return [];
  if (!response.ok)
    throw new Error(
      `GitHub API ${response.status}: ${response.status === 403 ? "permission or rate limit error" : "request failed"}`,
    );
  return response.json();
}
export async function installationToken(installationId: number) {
  const data = await github(`/app/installations/${installationId}/access_tokens`, await appJwt(), {
    method: "POST",
  });
  return data.token as string;
}
export async function verifySignature(body: string, header: string | null) {
  const secret = Deno.env.get("GITHUB_WEBHOOK_SECRET");
  if (!secret || !header?.startsWith("sha256=")) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(body)));
  const expected = `sha256=${Array.from(digest, (n) => n.toString(16).padStart(2, "0")).join("")}`;
  if (header.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < header.length; i++) diff |= header.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}
export type EventInput = {
  user_id: string;
  project_id: string;
  repository_id: string;
  event_key: string;
  kind: "commit" | "pull_request" | "merge";
  title: string;
  html_url: string;
  author_login: string | null;
  occurred_at: string;
  source: "webhook" | "backfill" | "reconcile";
};
export async function saveEvents(events: EventInput[]) {
  if (!events.length) return 0;
  let inserted = 0;
  for (let index = 0; index < events.length; index += 100) {
    const { data, error } = await admin
      .from("github_events")
      .upsert(events.slice(index, index + 100), {
        onConflict: "repository_id,event_key",
        ignoreDuplicates: true,
      }).select("id");
    if (error) throw error;
    inserted += data?.length ?? 0;
  }
  return inserted;
}
