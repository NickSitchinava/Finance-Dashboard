import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.99.0';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};
const response = (body: unknown, status: number) => new Response(JSON.stringify(body), { status, headers: cors });

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (request.method !== 'POST') return response({ error: 'Method not allowed' }, 405);
  const bearer = request.headers.get('Authorization');
  if (!bearer?.startsWith('Bearer ')) return response({ error: 'Authentication required' }, 401);
  const url = Deno.env.get('SUPABASE_URL');
  const anon = Deno.env.get('SUPABASE_ANON_KEY');
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anon || !service) return response({ error: 'Service unavailable' }, 503);
  try {
    const body = await request.json();
    if (typeof body?.password !== 'string' || !body.password || body.password.length > 1024) {
      return response({ error: 'Current password required' }, 400);
    }
    const userClient = createClient(url, anon, { auth: { persistSession: false } });
    const { data: identity, error: identityError } = await userClient.auth.getUser(bearer.slice(7));
    if (identityError || !identity.user?.email) return response({ error: 'Authentication required' }, 401);
    const { data: verified, error: passwordError } = await userClient.auth.signInWithPassword({
      email: identity.user.email,
      password: body.password,
    });
    if (passwordError || verified.user?.id !== identity.user.id) {
      return response({ error: 'Current password could not be verified' }, 403);
    }
    const admin = createClient(url, service, { auth: { persistSession: false } });
    const { data: connections, error: connectionError } = await admin
      .from('github_connections')
      .select('id,state')
      .eq('user_id', identity.user.id);
    if (connectionError) return response({ error: 'GitHub connection could not be checked' }, 503);
    if (connections?.some((connection) => connection.state === 'connected')) {
      // Exercise the same live repository fetch used by Projects before any deletion.
      try {
        const check = await fetch(`${url}/functions/v1/github-sync`, {
          method: 'POST',
          headers: {
            Authorization: bearer,
            apikey: anon,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ action: 'repositories' }),
        });
        const result = check.ok ? await check.json() : null;
        if (!check.ok || !Array.isArray(result?.repositories)) {
          return response({ error: 'GitHub repository access could not be verified. No data was cleared.' }, 503);
        }
      } catch {
        return response({ error: 'GitHub repository access could not be verified. No data was cleared.' }, 503);
      }
    }
    const { error } = await admin.rpc('clear_application_data', { p_user_id: identity.user.id });
    if (error) {
      console.error('clear_application_data failed', { code: error.code, userId: identity.user.id });
      return response({ error: 'Data clearing failed' }, 500);
    }
    return response({ cleared: true }, 200);
  } catch {
    return response({ error: 'Invalid request' }, 400);
  }
});
