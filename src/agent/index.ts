// The one door to the agent for chat, search and tags. Each call tries the real
// LLM first (llm.ts) and falls back to the scripted agent; `sample: true` means
// the scripted agent answered and the UI shows "Sample answer".
import { localToday, ownerOf, chosenLabel, decisionDate } from '../store/dashboard';
import type { AppState, ChatMessage, Citation } from '../types';
import { scriptedReply, type ChatScope } from './chat';
import { callLlm } from './llm';
import { think } from './mockAgent';
import { suggestTagsNow } from './tags';

export interface AgentAnswer {
  text: string;
  citations: Citation[];
  sample: boolean;
}

// What the LLM sees: a compact summary of every decision, plus the evidence for
// the decision in scope. Context the PM marked wrong or removed is left out.
function chatPayload(question: string, scope: ChatScope, state: AppState, history: ChatMessage[]) {
  const decision = state.decisions.find((d) => d.id === scope.decisionId);
  const option = state.options.find((o) => o.id === scope.optionId);
  return {
    question,
    scope: { decisionQuestion: decision?.question, optionLabel: option?.label },
    decisions: state.decisions.map((d) => ({
      id: d.id,
      question: d.question,
      owner: ownerOf(d, state)?.name,
      date: decisionDate(d),
      status: d.status,
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
          .map((c) => ({ source: c.sourceLabel, author: c.author, date: c.date, text: c.snippet }))
      : [],
    history: history.map((m) => ({ role: m.role, text: m.text })),
  };
}

export async function askAgent(
  question: string,
  scope: ChatScope,
  state: AppState,
  history: ChatMessage[] = [],
): Promise<AgentAnswer> {
  const llm = await callLlm<{ text?: unknown; citations?: unknown }>(
    'chat',
    chatPayload(question, scope, state, history),
  );
  if (llm && typeof llm.text === 'string' && llm.text.trim()) {
    // Only keep citations that point at real decisions.
    const ids = Array.isArray(llm.citations) ? llm.citations.filter((c): c is string => typeof c === 'string') : [];
    const citations = ids
      .map((id) => state.decisions.find((d) => d.id === id))
      .filter((d): d is NonNullable<typeof d> => !!d)
      .map((d) => ({ decisionId: d.id, label: d.question }));
    return { text: llm.text.trim(), citations, sample: false };
  }
  const reply = scriptedReply(question, scope, state, localToday());
  return think({ ...reply, sample: true });
}

export async function suggestTags(
  question: string,
  notes: string,
  current: string[],
  existing: string[],
): Promise<{ tags: string[]; sample: boolean }> {
  const llm = await callLlm<{ tags?: unknown }>('suggestTags', { question, notes, current, existingTags: existing });
  if (llm && Array.isArray(llm.tags)) {
    const have = new Set(current.map((t) => t.toLowerCase()));
    const tags = llm.tags
      .filter((t): t is string => typeof t === 'string')
      .map((t) => t.trim().toLowerCase().replace(/^#/, ''))
      .filter((t, i, all) => t && t.length <= 24 && !have.has(t) && all.indexOf(t) === i)
      .slice(0, 3);
    return { tags, sample: false };
  }
  return think({ tags: suggestTagsNow(question, notes, current, existing), sample: true }, 300);
}

export type { ChatScope };
