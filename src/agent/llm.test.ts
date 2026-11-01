// The real-LLM path (decision record 0007), with fetch stubbed: answers from the
// Edge Function are used and their citations checked; anything else falls back
// to the scripted agent and is marked as a sample.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { demoUser, seedState } from '../data/fixtures';
import type { AppState } from '../types';

const state = (): AppState => ({ ...seedState(), user: structuredClone(demoUser) });

function respond(status: number, body: unknown) {
  return vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));
}

// llm.ts remembers "not configured" for the page load, so each test gets a fresh copy.
async function load() {
  vi.resetModules();
  return import('./index');
}

beforeEach(() => {
  vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-test-key');
});

afterEach(() => {
  vi.stubEnv('VITE_SUPABASE_URL', '');
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
  vi.unstubAllGlobals();
});

describe('askAgent with an LLM endpoint', () => {
  it('F-12: uses the LLM answer, posts to the agent function, and keeps only citations of real decisions', async () => {
    const fetch = respond(200, {
      ok: true,
      result: { text: 'You chose the checklist.', citations: ['d-onboarding-checklist', 'd-made-up'] },
    });
    vi.stubGlobal('fetch', fetch);
    const { askAgent } = await load();
    const answer = await askAgent('Why the checklist?', {}, state());
    expect(answer.sample).toBe(false);
    expect(answer.text).toBe('You chose the checklist.');
    expect(answer.citations.map((c) => c.decisionId)).toEqual(['d-onboarding-checklist']);
    expect(fetch).toHaveBeenCalledWith('https://example.supabase.co/functions/v1/agent', expect.anything());
    const sent = JSON.parse(fetch.mock.calls[0][1].body as string);
    expect(sent.task).toBe('chat');
  });

  it('F-08: context the PM removed or marked wrong is never sent to the LLM', async () => {
    const fetch = respond(200, { ok: true, result: { text: 'ok', citations: [] } });
    vi.stubGlobal('fetch', fetch);
    const s = state();
    s.contextItems = s.contextItems.map((c) => ({ ...c, flaggedInaccurate: true }));
    const { askAgent } = await load();
    await askAgent('What happened?', { decisionId: 'd-onboarding-checklist' }, s);
    const sent = JSON.parse(fetch.mock.calls[0][1].body as string);
    expect(sent.payload.context).toEqual([]);
  });

  it('falls back to a sample answer on not_configured, and stops asking for the rest of the page load', async () => {
    const fetch = respond(503, { ok: false, error: 'not_configured' });
    vi.stubGlobal('fetch', fetch);
    const { askAgent } = await load();
    expect((await askAgent('Why did we choose the checklist?', {}, state())).sample).toBe(true);
    expect((await askAgent('What outcomes are due?', {}, state())).sample).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('falls back when the function needs a signed-in user (sign-in is mocked)', async () => {
    vi.stubGlobal('fetch', respond(401, { ok: false, error: 'sign_in_required' }));
    const { askAgent } = await load();
    expect((await askAgent('Why did we choose the checklist?', {}, state())).sample).toBe(true);
  });

  it('falls back on a network error, a provider error, a non-JSON body or an answer without text', async () => {
    const cases = [
      vi.fn().mockRejectedValue(new TypeError('network down')),
      respond(502, { ok: false, error: 'provider_error' }),
      vi.fn().mockResolvedValue(new Response('<html>oops</html>', { status: 200 })),
      respond(200, { ok: true, result: { citations: ['d-onboarding-checklist'] } }),
    ];
    for (const fetch of cases) {
      vi.stubGlobal('fetch', fetch);
      const { askAgent } = await load();
      const answer = await askAgent('Why did we choose the checklist?', {}, state());
      expect(answer.sample).toBe(true);
      expect(answer.citations[0].decisionId).toBe('d-onboarding-checklist');
    }
  });

  it('dedupes and cleans LLM tag suggestions', async () => {
    vi.stubGlobal('fetch', respond(200, { ok: true, result: { tags: ['Pricing', '#pricing', 'trials', 'growth', 42] } }));
    const { suggestTags } = await load();
    const result = await suggestTags('Trial pricing?', '', ['growth'], []);
    expect(result).toEqual({ tags: ['pricing', 'trials'], sample: false });
  });
});
