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
  return { text: result.text, citations };
}

/** Short starters shown above the chat box, per scope. */
export function suggestedPrompts(scope: ChatScope, state: AppState, today: string): string[] {
  if (scope.optionId) return ['What could make this wrong?', 'What evidence supports it?'];
  if (scope.decisionId) return ['How do the options compare?', 'What’s still missing?', 'Any related past decisions?'];
  if (state.decisions.length === 0) return ['How should I frame my first decision?'];
  const due = inboxItems(state, today).some((i) => i.kind === 'outcome-due');
  return [due ? 'What outcomes are due?' : 'What’s still open?', 'What did we decide recently?', 'What have we tried before?'];
}
