// Rooted's agent endpoint (decision record 0007). The browser never holds the
// LLM key: it posts { task, payload } here, this function calls the provider
// named by LLM_PROVIDER and returns { ok: true, result }. With no provider or
// key configured it answers 503 not_configured, and the app falls back to its
// scripted sample answers (labelled "Sample answer" in the UI).
//
// Only a signed-in Supabase user may spend the provider key: the public anon
// key alone gets 401 sign_in_required. The prototype's sign-in is still mocked,
// so on the hosted project the app keeps using sample answers until real auth
// lands. For local testing only, AGENT_ALLOW_ANONYMOUS=true skips the check.
//
// Local: supabase functions serve agent --env-file supabase/functions/.env.local
import { createClient } from 'npm:@supabase/supabase-js@2.117.3';
import { buildPrompt, TASKS, type Task } from './prompts.ts';
import { getProvider, ProviderError } from './providers/index.ts';

const MAX_BODY_BYTES = 128_000;
// Best effort: counts live per function instance, so this caps bursts, not a monthly bill.
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 10 * 60_000;
const recent = new Map<string, number[]>();

function overLimit(userId: string): boolean {
  const now = Date.now();
  const hits = (recent.get(userId) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  hits.push(now);
  recent.set(userId, hits);
  return hits.length > RATE_LIMIT;
}

async function signedInUser(req: Request): Promise<string | null> {
  if (Deno.env.get('AGENT_ALLOW_ANONYMOUS') === 'true') return 'local-anonymous';
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const url = Deno.env.get('SUPABASE_URL');
  const anon = Deno.env.get('SUPABASE_ANON_KEY');
  if (!token || !url || !anon) return null;
  // The anon key is a valid JWT but carries no user, so getUser rejects it.
  const { data, error } = await createClient(url, anon).auth.getUser(token);
  return error || !data.user ? null : data.user.id;
}

const cors = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function reply(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return reply(405, { ok: false, error: 'method_not_allowed' });

  const configured = getProvider();
  if (!configured) return reply(503, { ok: false, error: 'not_configured' });
  const userId = await signedInUser(req);
  if (!userId) return reply(401, { ok: false, error: 'sign_in_required' });
  if (overLimit(userId)) return reply(429, { ok: false, error: 'rate_limited' });

  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) return reply(413, { ok: false, error: 'too_large' });
  let body: { task?: string; payload?: unknown };
  try {
    body = JSON.parse(raw);
  } catch {
    return reply(400, { ok: false, error: 'bad_json' });
  }
  if (!TASKS.includes(body.task as Task)) return reply(400, { ok: false, error: 'unknown_task' });

  const prompt = buildPrompt(body.task as Task, body.payload);
  try {
    const result = await configured.provider.generateJson(prompt, configured.apiKey, configured.model);
    return reply(200, { ok: true, result });
  } catch (error) {
    const code = error instanceof ProviderError ? error.code : 'provider_error';
    // Never echo provider error bodies: they can include request details.
    console.error('agent task failed', body.task, code);
    return reply(502, { ok: false, error: code });
  }
});
