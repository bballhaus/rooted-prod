// A gathered brief for tests that need one in the store: one item from each
// allowed sample channel, plus a past decision, mapped the way gatherBrief does.
import { sampleMessages } from '../agent/brief';
import type { AppState, ContextItem, Decision, Gap } from '../types';

export function briefFor(decision: Decision, state: AppState): { items: ContextItem[]; gaps: Gap[] } {
  const perSource = new Map<string, ReturnType<typeof sampleMessages>[number]>();
  for (const m of sampleMessages(state)) if (!perSource.has(m.source)) perSource.set(m.source, m);
  const past = state.decisions.find((d) => d.status === 'decided' && d.id !== decision.id);
  const base = { decisionId: decision.id, flaggedInaccurate: false, userEdited: false, removed: false };
  const items: ContextItem[] = [...perSource.values()].map((m) => ({
    ...base,
    id: `${decision.id}-${m.ref}`,
    origin: m.ref.startsWith('drive:') ? 'drive' : 'slack',
    sourceLabel: m.source,
    author: m.author,
    date: m.date,
    snippet: m.text,
    group: 'Team discussion',
  }));
  if (past) {
    items.push({ ...base, id: `${decision.id}-${past.id}`, origin: 'past-decision', sourceLabel: `Past decision: ${past.question}`, date: past.createdAt.slice(0, 10), snippet: past.rationale ?? past.question, group: 'History' });
  }
  return { items, gaps: [{ id: `${decision.id}-gap-1`, decisionId: decision.id, question: 'What result would make this worth it?' }] };
}
