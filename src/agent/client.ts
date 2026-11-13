// The one door to Rooted's AI service on Modal (decision 0016). Every agent
// feature calls Claude through here, signed in as the PM. There are no
// scripted answers: when a call fails, it throws an AiError and the feature
// shows what happened and lets the PM retry or do the step themselves.

export type AiTask =
  | 'chat'
  | 'suggestTags'
  | 'brief'
  | 'options'
  | 'subOptions'
  | 'draftRecord'
  | 'findLinks'
  | 'spotDecisions';

export type AiErrorCode =
  | 'not_configured'
  | 'sign_in_required'
  | 'auth_unavailable'
  | 'rate_limited'
  | 'budget_reached'
  | 'provider_busy'
  | 'provider_timeout'
  | 'provider_unreachable'
  | 'provider_error'
  | 'provider_rejected'
  | 'refused'
  | 'too_long'
  | 'bad_output'
  | 'bad_payload'
  | 'too_large'
  | 'slack_not_connected'
  | 'slack_not_configured'
  | 'slack_token_revoked'
  | 'slack_error'
  | 'network'
  | 'unknown';

export class AiError extends Error {
  constructor(public code: AiErrorCode) {
    super(code);
    this.name = 'AiError';
  }
}

export function errorCode(error: unknown): AiErrorCode {
  return error instanceof AiError ? error.code : 'unknown';
}

// What the PM reads for each failure: what happened and what to do.
export const AI_ERROR_MESSAGE: Record<AiErrorCode, string> = {
  not_configured: 'Rooted’s AI isn’t switched on here yet. You can still do this step yourself.',
  sign_in_required: 'Your session ended. Sign in again to use Rooted’s AI.',
  auth_unavailable: 'Rooted couldn’t confirm your sign-in just now. Try again in a moment.',
  rate_limited: 'That’s a lot of requests in a few minutes. Wait a little, then try again.',
  budget_reached: 'Rooted has used today’s AI budget. It resets at midnight UTC; you can do this step yourself until then.',
  provider_busy: 'The AI is busy right now. Try again in a minute.',
  provider_timeout: 'The AI took too long to answer. Try again.',
  provider_unreachable: 'Rooted couldn’t reach the AI. Check your connection and try again.',
  provider_error: 'The AI had a problem answering. Try again.',
  provider_rejected: 'The AI couldn’t work with that request. Try shortening your notes, or do this step yourself.',
  refused: 'The AI declined to answer this one. Try rewording it, or do this step yourself.',
  too_long: 'The answer ran too long and was cut off. Try again, or narrow the question.',
  bad_output: 'The AI’s answer didn’t hold up (it cited things that weren’t there). Try again.',
  bad_payload: 'Something about this decision couldn’t be sent. Check the question isn’t empty, then try again.',
  too_large: 'There’s too much here to send at once. Remove some context, then try again.',
  slack_not_connected: 'Connect Slack first, or turn off Slack for this brief.',
  slack_not_configured: 'Slack isn’t set up for this copy of Rooted yet.',
  slack_token_revoked: 'Rooted’s access to Slack was removed. Connect Slack again to read your channels.',
  slack_error: 'Slack didn’t answer just now. Try again in a minute.',
  network: 'Rooted couldn’t reach its AI service. Check your connection and try again.',
  unknown: 'Something went wrong. Try again, and report a problem from Help if it keeps happening.',
};

export interface SlackStatus {
  available: boolean; // Slack is set up on the service
  connected: boolean;
  revoked?: boolean;
  teamName?: string;
  connectedAt?: number;
  channels?: { id: string; name: string; memberCount: number }[];
}

export interface AiClient {
  run<T>(task: AiTask, payload: unknown): Promise<T>;
  slackStatus(): Promise<SlackStatus>;
  slackInstallUrl(): Promise<string>;
  slackDisconnect(): Promise<void>;
}

const TIMEOUT_MS = 120_000;
const KNOWN = new Set<string>(Object.keys(AI_ERROR_MESSAGE));

/** The real client, or null when the app has no AI service URL (see .env.example). */
export function createAiClient(baseUrl: string | undefined, getToken: () => Promise<string | null>): AiClient | null {
  if (!baseUrl) return null;
  const base = baseUrl.replace(/\/$/, '');

  async function call<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
    const token = await getToken();
    if (!token) throw new AiError('sign_in_required');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(`${base}${path}`, {
        method,
        headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
    } catch (error) {
      throw new AiError(controller.signal.aborted ? 'provider_timeout' : 'network');
    } finally {
      clearTimeout(timer);
    }
    let json: { ok?: boolean; result?: T; error?: string } = {};
    try {
      json = await res.json();
    } catch {
      throw new AiError('unknown');
    }
    if (json.ok && json.result !== undefined) return json.result;
    throw new AiError(json.error && KNOWN.has(json.error) ? (json.error as AiErrorCode) : 'unknown');
  }

  return {
    run: (task, payload) => call('POST', '/agent', { task, payload }),
    slackStatus: () => call('GET', '/slack/status'),
    slackInstallUrl: async () => (await call<{ url: string }>('POST', '/slack/install', {})).url,
    slackDisconnect: async () => {
      await call('POST', '/slack/disconnect', {});
    },
  };
}
