// Synthetic options for tests that start with a decision tree already laid out.
// Same labels the fake AI answers with (src/test/fakeAi.ts).
import { citableContext } from '../agent/options';
import type { ContextItem, Decision, OptionNode } from '../types';

export const OPTION_LABELS = ['Usage limit', '14-day time limit', 'Gather more evidence first'] as const;

export function sampleOptions(decision: Decision, contextItems: ContextItem[]): OptionNode[] {
  const evidence = citableContext(decision.id, contextItems).map((c) => c.id);
  const stem = `o-${decision.id.replace(/^d-/, '')}`;
  return OPTION_LABELS.map((label, i) => ({
    id: `${stem}-${i + 1}`,
    decisionId: decision.id,
    parentId: null,
    label,
    summary: `${label}, as a first step.`,
    pros: [`${label} is quick to try`],
    cons: [`${label} may not scale`],
    score: [70, 55, 30][i],
    criteria: { impact: 3, effort: 2, risk: 2, evidence: Math.min(5, 1 + (i < 2 ? 1 : 0)) },
    contextIds: i < 2 && evidence[i] ? [evidence[i]] : [],
    state: 'open',
  }));
}
