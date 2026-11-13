// F-10, F-11: options as a decision tree. Claude lays out 2–4 branches, or
// splits one branch into sub-options, with rough ratings and the evidence each
// rests on. Scores are a rough guide; the PM prunes and chooses.
import type { AppState, ContextItem, Criteria, Decision, OptionNode } from '../types';
import { pastDecisionsFor } from './brief';
import type { AiClient } from './client';

interface DraftOption {
  label: string;
  summary: string;
  pros: string[];
  cons: string[];
  score: number;
  criteria: Criteria;
  contextIds: string[];
  linkedDecisionId: string | null;
}

/** Evidence the agent may cite: this decision's items the PM hasn't removed or flagged. */
export function citableContext(decisionId: string, contextItems: ContextItem[]): ContextItem[] {
  return contextItems.filter((c) => c.decisionId === decisionId && !c.removed && !c.flaggedInaccurate);
}

function evidenceFor(decision: Decision, state: AppState) {
  return citableContext(decision.id, state.contextItems).map((c) => ({
    id: c.id,
    source: c.sourceLabel,
    author: c.author ?? null,
    text: c.snippet,
  }));
}

function framing(decision: Decision) {
  return { question: decision.question, notes: decision.notes, constraints: decision.constraints };
}

function toNode(o: DraftOption, id: string, decisionId: string, parentId: string | null): OptionNode {
  return {
    id,
    decisionId,
    parentId,
    label: o.label,
    summary: o.summary,
    pros: o.pros,
    cons: o.cons,
    score: o.score,
    criteria: o.criteria,
    contextIds: o.contextIds,
    state: 'open',
    ...(o.linkedDecisionId ? { linkedDecisionId: o.linkedDecisionId } : {}),
  };
}

/** Ids that don't collide with options already in the store. */
function freshIds(stem: string, count: number, taken: Set<string>): string[] {
  const ids: string[] = [];
  for (let n = 1; ids.length < count; n++) {
    const id = `${stem}-${n}`;
    if (!taken.has(id)) ids.push(id);
  }
  return ids;
}

export async function fetchOptions(ai: AiClient, decision: Decision, state: AppState): Promise<OptionNode[]> {
  const result = await ai.run<{ options: DraftOption[] }>('options', {
    decision: framing(decision),
    evidence: evidenceFor(decision, state),
    gaps: state.gaps.filter((g) => g.decisionId === decision.id).map((g) => ({ question: g.question, answer: g.answer ?? null })),
    pastDecisions: pastDecisionsFor(state, decision.id),
  });
  // A new set replaces the old one (setOptions), so only the PM's own options' ids are taken.
  const taken = new Set(state.options.filter((o) => o.decisionId === decision.id && o.id.startsWith('o-user-')).map((o) => o.id));
  const ids = freshIds(`o-${decision.id.replace(/^d-/, '')}`, result.options.length, taken);
  return result.options.map((o, i) => toNode(o, ids[i], decision.id, null));
}

export async function fetchSubOptions(ai: AiClient, decision: Decision, parent: OptionNode, state: AppState): Promise<OptionNode[]> {
  const own = state.options.filter((o) => o.decisionId === decision.id);
  const result = await ai.run<{ options: DraftOption[] }>('subOptions', {
    decision: framing(decision),
    parent: { id: parent.id, label: parent.label, summary: parent.summary, pros: parent.pros, cons: parent.cons },
    siblings: own.filter((o) => o.parentId === parent.id).map((o) => o.label),
    evidence: evidenceFor(decision, state),
  });
  // Own namespace: a sub-option under the PM's option is still agent output,
  // so it must not inherit the `o-user-` prefix.
  const ids = freshIds(`o-sub-${parent.id.replace(/^o-/, '')}`, result.options.length, new Set(own.map((o) => o.id)));
  return result.options.map((o, i) => toNode(o, ids[i], decision.id, parent.id));
}
