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
  | 'spotDecisions'
  | 'findPatterns';

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
  | 'provider_key'
  | 'refused'
  | 'too_long'
  | 'bad_output'
  | 'bad_payload'
  | 'too_large'
  | 'slack_not_connected'
  | 'slack_not_configured'
  | 'slack_token_revoked'
  | 'slack_error'
  | 'slack_state_mismatch'
  | 'slack_state_expired'
  | 'nothing_to_read'
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
  provider_key:
    'Rooted’s AI service is running, but Anthropic refused its API key. Whoever deployed Rooted needs to check the key in the rooted-anthropic secret. You can still do this step yourself.',
  refused: 'The AI declined to answer this one. Try rewording it, or do this step yourself.',
  too_long: 'The answer ran too long and was cut off. Try again, or narrow the question.',
  bad_output: 'The AI’s answer didn’t hold up (it cited things that weren’t there). Try again.',
  bad_payload: 'Something about this decision couldn’t be sent. Check the question isn’t empty, then try again.',
  too_large: 'There’s too much here to send at once. Remove some context, then try again.',
  slack_not_connected: 'Connect Slack first, or turn off Slack for this brief.',
  slack_not_configured: 'Connecting Slack isn’t set up for this copy of Rooted yet: it needs Rooted’s AI service, which hasn’t been deployed here. Your demo and sign-in still work.',
  slack_token_revoked: 'Rooted’s access to Slack was removed. Connect Slack again to read your channels.',
  slack_error: 'Slack didn’t answer just now. Try again in a minute.',
  slack_state_mismatch: 'That Slack connection was started from a different Rooted account, so it wasn’t saved. Connect Slack again from here.',
  slack_state_expired: 'That Slack connection took too long or was already used. Connect Slack again from here.',
  nothing_to_read: 'There’s nothing to read yet. Connect Slack and allow at least one channel first.',
  network: 'Rooted couldn’t reach its AI service. Check your connection and try again.',
  unknown: 'Something went wrong. Try again, and report a problem from Help if it keeps happening.',
};

// Errors a second try can fix. The rest need the PM to change something first.
const RETRYABLE = new Set<AiErrorCode>([
  'auth_unavailable',
  'provider_busy',
  'provider_timeout',
  'provider_unreachable',
  'provider_error',
  'refused',
  'too_long',
  'bad_output',
  'slack_error',
  'network',
  'unknown',
]);

export function isRetryable(code: AiErrorCode): boolean {
  return RETRYABLE.has(code);
}

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
  /** Finishes an install Slack sent back, as the signed-in PM (0017). */
  slackComplete(code: string, state: string): Promise<{ connected: boolean; teamName: string }>;
  slackDisconnect(): Promise<void>;
}

// Longer than the service's worst case (sign-in check, Slack reads, Claude at
// 50 seconds with one retry), so a slow answer isn't abandoned and paid twice.
const TIMEOUT_MS = 150_000;
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
    slackComplete: (code, state) => call('POST', '/slack/complete', { code, state }),
    slackDisconnect: async () => {
      await call('POST', '/slack/disconnect', {});
    },
  };
}

/**
 * Fits text to the service's limits (question 500, notes 4,000, any piece of
 * context 6,000 characters), marking the cut so Claude knows it's partial.
 * Better than refusing the whole request over one long paste.
 */
export function fit(text: string | undefined, max: number): string {
  const t = text ?? '';
  return t.length <= max ? t : `${t.slice(0, max - 13)} [shortened]`;
}

export const LIMITS = { question: 500, notes: 4000, constraint: 300, constraints: 20, context: 6000, chat: 2000, summary: 2000 } as const;

export function framingOf(decision: { question: string; notes: string; constraints: string[] }) {
  return {
    question: fit(decision.question, LIMITS.question),
    notes: fit(decision.notes, LIMITS.notes),
    constraints: decision.constraints.slice(0, LIMITS.constraints).map((c) => fit(c, LIMITS.constraint)),
  };
}
