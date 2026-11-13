// A stand-in for Rooted's AI service in tests, so no test calls Claude.
// Each task answers with synthetic output built from what it was sent, in the
// same shape the service returns; a test can make any task fail instead.
import { vi } from 'vitest';
import { AiError, type AiClient, type AiErrorCode, type AiTask, type SlackStatus } from '../agent/client';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Payload = Record<string, any>;
type Answer = unknown | AiErrorCode | ((payload: Payload) => unknown);

const option = (label: string, contextIds: string[], score: number) => ({
  label,
  summary: `${label}, as a first step.`,
  pros: [`${label} is quick to try`],
  cons: [`${label} may not scale`],
  score,
  criteria: { impact: 3, effort: 2, risk: 2, evidence: Math.min(5, 1 + contextIds.length) },
  contextIds,
  linkedDecisionId: null,
});

export const DEFAULT_ANSWERS: Record<AiTask, (p: Payload) => unknown> = {
  chat: (p) => ({
    text: `Here’s what I found about “${p.question}”.`,
    citations: (p.decisions ?? []).slice(0, 1).map((d: Payload) => d.id),
  }),
  suggestTags: () => ({ tags: ['pricing', 'growth'] }),
  brief: (p) => ({
    items: (p.messages ?? []).slice(0, 3).map((m: Payload, i: number) => ({
      kind: 'message',
      ref: m.ref,
      group: i === 0 ? 'Customer signal' : 'Team discussion',
      source: m.source,
      author: m.author ?? null,
      date: m.date,
      text: m.text,
      link: null,
    })),
    gaps: ['What result would make this worth it?', 'Who else needs to agree before you decide?'],
  }),
  options: (p) => {
    const ids: string[] = (p.evidence ?? []).map((e: Payload) => e.id);
    return { options: [option('Usage limit', ids.slice(0, 1), 70), option('14-day time limit', ids.slice(1, 2), 55), option('Gather more evidence first', [], 30)] };
  },
  subOptions: (p) => ({ options: [option(`${p.parent.label}, small pilot`, [], 60), option(`${p.parent.label}, full launch`, [], 45)] }),
  draftRecord: (p) => ({
    rationale: `${p.chosen.label} fits the evidence best.`,
    rejected: (p.others ?? []).map((o: Payload) => ({ optionId: o.id, reason: `${o.label} costs more for less.` })),
  }),
  findLinks: (p) => {
    const [a, b] = p.decisions ?? [];
    return { links: a && b ? [{ fromId: a.id, toId: b.id, kind: 'related', reason: 'Both touch the same customers.' }] : [] };
  },
  spotDecisions: (p) => {
    const m = (p.messages ?? [])[0];
    return {
      suggestions: m
        ? [{ question: 'Should we change how we onboard new teams?', why: 'People keep raising it.', evidence: [{ ...m, link: null }] }]
        : [],
    };
  },
};

export type FakeAi = AiClient & {
  run: AiClient['run'] & ReturnType<typeof vi.fn>;
  answers: Partial<Record<AiTask, Answer>>;
  slack: SlackStatus;
  slackStatus: ReturnType<typeof vi.fn>;
  slackInstallUrl: ReturnType<typeof vi.fn>;
  slackDisconnect: ReturnType<typeof vi.fn>;
};

/** A fake AI client. Set `answers[task]` to a result, a function of the payload, or an error code. */
export function fakeAi(answers: Partial<Record<AiTask, Answer>> = {}): FakeAi {
  const ai = {
    answers,
    slack: { available: true, connected: false } as SlackStatus,
  } as FakeAi;
  const run = vi.fn(async (task: AiTask, payload: Payload) => {
    const answer = task in ai.answers ? ai.answers[task] : DEFAULT_ANSWERS[task];
    if (typeof answer === 'string') throw new AiError(answer as AiErrorCode);
    return typeof answer === 'function' ? (answer as (p: Payload) => unknown)(payload) : answer;
  });
  ai.run = run as unknown as FakeAi['run'];
  ai.slackStatus = vi.fn(async () => ai.slack);
  ai.slackInstallUrl = vi.fn(async () => 'https://slack.com/oauth/v2/authorize?state=test');
  ai.slackDisconnect = vi.fn(async () => {
    ai.slack = { available: true, connected: false };
  });
  return ai;
}
