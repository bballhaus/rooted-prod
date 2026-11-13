// F-14, F-15: drafting the decision record. Once the PM picks an option,
// Claude drafts the rationale and a reason for each alternative not taken.
// The PM edits all of it before logging; nothing is logged without them.
import { splitForLog } from '../store/tree';
import type { AppState, Decision, OptionNode } from '../types';
import type { AiClient } from './client';
import { citableContext } from './options';

export interface RecordDraft {
  rationale: string;
  rejected: { optionId: string; reason: string }[];
}

const brief = (o: OptionNode) => ({ id: o.id, label: o.label, summary: o.summary, pros: o.pros, cons: o.cons });

export async function draftRecord(
  ai: AiClient,
  decision: Decision,
  options: OptionNode[],
  chosenOptionId: string,
  summary: string,
  state: AppState,
): Promise<RecordDraft> {
  const own = options.filter((o) => o.decisionId === decision.id);
  const chosen = own.find((o) => o.id === chosenOptionId);
  if (!chosen) throw new Error('chosen option not found');
  // Only the alternatives that branch off the chosen path need a reason;
  // options under an alternative are pruned with it.
  const others = splitForLog(own, chosen.id).alternatives;
  const draft = await ai.run<RecordDraft>('draftRecord', {
    decision: { question: decision.question, notes: decision.notes, constraints: decision.constraints },
    summary,
    chosen: brief(chosen),
    others: others.map(brief),
    evidence: citableContext(decision.id, state.contextItems).map((c) => ({ id: c.id, source: c.sourceLabel, author: c.author ?? null, text: c.snippet })),
  });
  // A reason the PM already wrote when pruning wins over a drafted one.
  const rejected = others.map((o) => ({
    optionId: o.id,
    reason: o.pruneReason?.trim() || draft.rejected.find((r) => r.optionId === o.id)?.reason || '',
  }));
  return { rationale: draft.rationale, rejected };
}
