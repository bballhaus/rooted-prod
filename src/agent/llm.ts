// The real-LLM path (decision record 0006). Calls the Supabase Edge Function in
// supabase/functions/agent, which holds the provider key. Returns null whenever
// the LLM can't answer (no Supabase URL set, no provider configured, an error
// or a timeout), and the caller falls back to the scripted agent, whose answers
// the UI labels "Sample answer".

export type LlmTask = 'chat' | 'suggestTags';

const TIMEOUT_MS = 20_000;

function endpoint(): { url: string; key: string } | null {
  const base = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!base || !key) return null;
  return { url: `${base.replace(/\/$/, '')}/functions/v1/agent`, key };
}

// Once the function says it can't serve this app (no provider, or no signed-in
// user while sign-in is mocked), stop asking for this page load.
let notConfigured = false;

export async function callLlm<T>(task: LlmTask, payload: unknown): Promise<T | null> {
  const target = endpoint();
  if (!target || notConfigured) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(target.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${target.key}`,
        apikey: target.key,
      },
      body: JSON.stringify({ task, payload }),
      signal: controller.signal,
    });
    const body = (await res.json().catch(() => null)) as { ok?: boolean; result?: T; error?: string } | null;
    if (body?.error === 'not_configured' || body?.error === 'sign_in_required') notConfigured = true;
    return res.ok && body?.ok ? (body.result ?? null) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
