// The client for Rooted's AI service: it signs every call with the PM's
// session and turns every failure into a code the app can explain. Fetch is
// stubbed; nothing here reaches Modal or Claude.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AI_ERROR_MESSAGE, AiError, createAiClient } from './client';

const respond = (status: number, body: unknown) =>
  vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));

const token = () => Promise.resolve('session-token');

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('AI client', () => {
  it('is off without a service URL, so features say AI isn’t switched on', () => {
    expect(createAiClient(undefined, token)).toBeNull();
    expect(createAiClient('', token)).toBeNull();
  });

  it('F-12: posts the task with the PM’s session token and returns the result', async () => {
    const fetch = respond(200, { ok: true, result: { text: 'hi', citations: [] } });
    vi.stubGlobal('fetch', fetch);
    const ai = createAiClient('https://ai.example/', token)!;
    await expect(ai.run('chat', { question: 'q' })).resolves.toEqual({ text: 'hi', citations: [] });
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe('https://ai.example/agent');
    expect(init.headers.Authorization).toBe('Bearer session-token');
    expect(JSON.parse(init.body)).toEqual({ task: 'chat', payload: { question: 'q' } });
  });

  it('F-01: without a session it asks the PM to sign in, without calling the service', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const ai = createAiClient('https://ai.example', () => Promise.resolve(null))!;
    await expect(ai.run('chat', {})).rejects.toMatchObject({ code: 'sign_in_required' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([
    [429, 'rate_limited'],
    [503, 'budget_reached'],
    [502, 'refused'],
    [502, 'bad_output'],
    [409, 'slack_not_connected'],
  ] as const)('passes the service’s %s %s through as its own error code', async (status, code) => {
    vi.stubGlobal('fetch', respond(status, { ok: false, error: code }));
    await expect(createAiClient('https://ai.example', token)!.run('brief', {})).rejects.toMatchObject({ code });
  });

  it('an error code the app doesn’t know becomes unknown, never a crash', async () => {
    vi.stubGlobal('fetch', respond(500, { ok: false, error: 'brand_new_thing' }));
    await expect(createAiClient('https://ai.example', token)!.run('chat', {})).rejects.toMatchObject({ code: 'unknown' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>gateway down</html>', { status: 502 })));
    await expect(createAiClient('https://ai.example', token)!.run('chat', {})).rejects.toMatchObject({ code: 'unknown' });
  });

  it('a network failure is a network error the PM can retry', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    const error = (await createAiClient('https://ai.example', token)!
      .run('chat', {})
      .catch((e: unknown) => e)) as AiError;
    expect(error).toBeInstanceOf(AiError);
    expect(error.code).toBe('network');
  });

  it('gives up after two minutes and says the AI took too long', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init: RequestInit) => new Promise((_resolve, reject) => init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))))),
    );
    const pending = createAiClient('https://ai.example', token)!
      .run('options', {})
      .catch((e: unknown) => e as AiError);
    await vi.advanceTimersByTimeAsync(120_000);
    expect(((await pending) as AiError).code).toBe('provider_timeout');
  });

  it('Slack status, install and disconnect go to their own endpoints', async () => {
    const fetch = respond(200, { ok: true, result: { url: 'https://slack.com/oauth/v2/authorize?x=1' } });
    vi.stubGlobal('fetch', fetch);
    const ai = createAiClient('https://ai.example', token)!;
    await expect(ai.slackInstallUrl()).resolves.toBe('https://slack.com/oauth/v2/authorize?x=1');
    expect(fetch.mock.calls[0][0]).toBe('https://ai.example/slack/install');
    fetch.mockResolvedValue(new Response(JSON.stringify({ ok: true, result: { available: true, connected: false } }), { status: 200 }));
    await expect(ai.slackStatus()).resolves.toEqual({ available: true, connected: false });
    expect(fetch.mock.calls[1]).toEqual(['https://ai.example/slack/status', expect.objectContaining({ method: 'GET' })]);
  });

  it('every error code has a plain message for the PM', () => {
    for (const message of Object.values(AI_ERROR_MESSAGE)) expect(message.length).toBeGreaterThan(20);
  });
});
