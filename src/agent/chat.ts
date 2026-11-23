// F-12, F-13: the agent chat. What Claude sees is a compact summary of every
// decision, plus the evidence for the decision in scope; context the PM marked
// wrong or removed is left out (F-08).
import { chosenLabel, decisionDate, inboxItems, ownerOf } from '../store/dashboard';
import type { AppState, ChatMessage, Citation } from '../types';
import { fit, LIMITS, type AiClient } from './client';

export interface ChatScope {
  decisionId?: string;
  optionId?: string;
}

export interface AgentAnswer {
  text: string;
  citations: Citation[];
}

export function chatPayload(question: string, scope: ChatScope, state: AppState, history: ChatMessage[]) {
  const decision = state.decisions.find((d) => d.id === scope.decisionId);
  const option = state.options.find((o) => o.id === scope.optionId);
  return {
    question: fit(question, LIMITS.chat),
    scope: { decisionQuestion: decision?.question, optionLabel: option?.label },
    decisions: state.decisions.map((d) => ({
      id: d.id,
      question: d.question,
      owner: ownerOf(d, state)?.name,
      date: decisionDate(d),
      status: d.status,
      // A planted demo direction, not a decision anyone has started (0009).
      plantedDirection: d.speculative || undefined,
      tags: (d.tags ?? []).map((t) => t.label),
      chosen: chosenLabel(d, state),
      rationale: d.rationale,
      notTaken: state.options
        .filter((o) => o.decisionId === d.id && o.state === 'pruned')
        .map((o) => ({ option: o.label, reason: o.pruneReason })),
      outcome: state.outcomes.find((o) => o.decisionId === d.id)?.summary,
      reviewDate: d.reviewDate,
      // The decision on screen carries its live branches and open questions, so
      // Rooted answers about the options the PM can see, not just pruned ones.
      ...(d.id === decision?.id ? inScope(d.id, state) : {}),
    })),
    context: decision
      ? state.contextItems
          .filter((c) => c.decisionId === decision.id && !c.removed && !c.flaggedInaccurate)
          .slice(0, 40)
          .map((c) => ({ source: c.sourceLabel, author: c.author, date: c.date, text: fit(c.snippet, LIMITS.context) }))
      : [],
    // Failed turns aren't conversation; leave them out.
    history: history.filter((m) => !m.failed).slice(-10).map((m) => ({ role: m.role, text: m.text })),
  };
}

function inScope(decisionId: string, state: AppState) {
  return {
    inScope: true,
    options: state.options
      .filter((o) => o.decisionId === decisionId && o.state !== 'pruned')
      .slice(0, 30)
      .map((o) => ({
        option: o.label,
        summary: fit(o.summary, LIMITS.context),
        pros: o.pros,
        cons: o.cons,
        // 1–5: higher impact and evidence are better; lower effort and risk are easier.
        ratings: o.criteria,
        chosen: o.state === 'chosen' || undefined,
        underBranch: state.options.find((p) => p.id === o.parentId)?.label,
      })),
    openQuestions: state.gaps.filter((g) => g.decisionId === decisionId && !g.answer).map((g) => g.question),
  };
}

/**
 * Claude sometimes names a decision by its id ("d-pricing-seats"). The PM never
 * sees ids, so each one becomes the decision's question.
 */
export function withoutIds(text: string, state: Pick<AppState, 'decisions'>): string {
  let out = text;
  // Longest first, so "d-pricing-seats-v2" isn't cut short by "d-pricing-seats".
  for (const d of [...state.decisions].sort((a, b) => b.id.length - a.id.length)) {
    if (!out.includes(d.id)) continue;
    const id = d.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // The id, or the id inside a matching pair of quotes, brackets or backticks,
    // and a full stop after it when the question already ends in "?" or ".".
    const stop = /[?.!]$/.test(d.question) ? '\\.?' : '';
    const bare = `(?<![\\w-])${id}(?![\\w-])`;
    const pairs = ['``', '""', '“”', '()', '[]'].map(([a, b]) => `\\${a}${bare}\\${b}`).join('|');
    const wrapped = new RegExp(`(?:${pairs}|${bare})${stop}`, 'g');
    // A function, so "$&" or "$1" in a question is kept as text, not read as a pattern.
    out = out.replace(wrapped, () => `“${d.question}”`);
  }
  return out;
}

export async function askAgent(
  ai: AiClient,
  question: string,
  scope: ChatScope,
  state: AppState,
  history: ChatMessage[] = [],
): Promise<AgentAnswer> {
  const result = await ai.run<{ text: string; citations: string[] }>('chat', chatPayload(question, scope, state, history));
  const citations = result.citations
    .map((id) => state.decisions.find((d) => d.id === id))
    .filter((d): d is NonNullable<typeof d> => !!d)
    .map((d) => ({ decisionId: d.id, label: d.question }));
  return { text: withoutIds(result.text, state), citations };
}

/** Short starters shown above the chat box, per scope. */
export function suggestedPrompts(scope: ChatScope, state: AppState, today: string): string[] {
  if (scope.optionId) return ['What could make this wrong?', 'What evidence supports it?'];
  if (scope.decisionId) return ['How do the options compare?', 'What’s still missing?', 'Any related past decisions?'];
  if (state.decisions.length === 0) return ['How should I frame my first decision?'];
  const due = inboxItems(state, today).some((i) => i.kind === 'outcome-due');
  return [due ? 'What outcomes are due?' : 'What’s still open?', 'What did we decide recently?', 'What have we tried before?'];
}
