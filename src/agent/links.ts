// F-19 and F-R2: connections between decisions and decisions spotted in Slack.
// Both come back as suggestions (✦, dashed) until the PM accepts or dismisses
// them, and both can be reported as wrong (F-28).
import type { AppState, DecisionLink, SuggestedDecision } from '../types';
import { briefSource, decisionSummary, sampleMessages, type BriefMessage } from './brief';
import type { AiClient } from './client';

export async function findLinks(ai: AiClient, state: AppState, now = new Date()): Promise<DecisionLink[]> {
  const decisions = state.decisions.map((d) => decisionSummary(d, state));
  const existing = state.links.map((l) => [l.fromId, l.toId]);
  const result = await ai.run<{ links: { fromId: string; toId: string; kind: DecisionLink['kind']; reason: string }[] }>('findLinks', {
    decisions,
    existingLinks: existing,
  });
  const stamp = now.getTime().toString(36);
  return result.links.map((l, i) => ({
    id: `l-ai-${stamp}-${i}`,
    fromId: l.fromId,
    toId: l.toId,
    kind: l.kind,
    origin: 'ai',
    status: 'suggested',
    reason: l.reason,
  }));
}

interface Spotted {
  question: string;
  why: string;
  evidence: (BriefMessage & { link?: string | null })[];
}

export async function spotDecisions(ai: AiClient, state: AppState, now = new Date()): Promise<SuggestedDecision[]> {
  const source = briefSource(state);
  const result = await ai.run<{ suggestions: Spotted[] }>('spotDecisions', {
    source,
    messages: source.kind === 'sample' ? sampleMessages(state) : [],
    existingDecisions: state.decisions.map((d) => d.question),
  });
  const stamp = now.getTime().toString(36);
  return result.suggestions.map((s, i) => ({
    id: `sg-ai-${stamp}-${i}`,
    question: s.question,
    why: s.why,
    evidence: s.evidence.map((e) => ({ sourceLabel: e.source, author: e.author, snippet: e.text })),
    suggestedAt: now.toISOString(),
    status: 'new',
  }));
}
