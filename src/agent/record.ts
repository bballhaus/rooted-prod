// F-15: the PM writes a 1–2 line summary and the fake agent drafts the rest of
// the record. No LLM: the draft is stitched together from the options' pros and
// cons and the decision's context. The PM edits every word before logging.
import type { ContextItem, Decision, OptionNode } from '../types';
import { think } from './mockAgent';

export interface RecordDraft {
  rationale: string;
  rejected: { optionId: string; reason: string }[];
}

function lowerFirst(s: string): string {
  // Leave acronyms and names alone ("SSO", "iOS").
  if (s.length > 1 && s[1] === s[1].toUpperCase() && /[A-Za-z]/.test(s[1])) return s;
  return s.charAt(0).toLowerCase() + s.slice(1);
}

function sentence(s: string): string {
  const t = s.trim();
  if (!t) return t;
  return /[.!?]$/.test(t) ? t : `${t}.`;
}

function joinList(items: string[]): string {
  if (items.length <= 1) return items.join('');
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

function cite(item: ContextItem): string {
  const who = item.author ? `${item.author} in ${item.sourceLabel}` : item.sourceLabel;
  return `${who}: “${item.snippet.trim()}”`;
}

// Pure version, used directly in tests.
export function draftRecordNow(
  decision: Decision,
  options: OptionNode[],
  chosenOptionId: string,
  summary: string,
  contextItems: ContextItem[],
): RecordDraft {
  const own = options.filter((o) => o.decisionId === decision.id);
  const chosen = own.find((o) => o.id === chosenOptionId);
  const live = contextItems.filter((c) => c.decisionId === decision.id && !c.removed && !c.flaggedInaccurate);

  const parts: string[] = [];
  if (summary.trim()) parts.push(sentence(summary));
  if (chosen) {
    if (chosen.pros.length) {
      parts.push(`Why ${chosen.label}: ${joinList(chosen.pros.map(lowerFirst))}.`);
    } else {
      parts.push(`Chose ${chosen.label} over the other options.`);
    }
    if (chosen.cons.length) {
      parts.push(`Known trade-off: ${joinList(chosen.cons.map(lowerFirst))}.`);
    }
  }
  if (decision.constraints.length) {
    parts.push(`It fits the constraints: ${joinList(decision.constraints.map(lowerFirst))}.`);
  }
  // Cite the evidence behind the chosen option first, then other live context.
  const linked = chosen ? live.filter((c) => chosen.contextIds.includes(c.id)) : [];
  const cited = (linked.length ? linked : live).slice(0, 2);
  if (cited.length) {
    parts.push(`Context: ${cited.map(cite).join(' ')}`);
  }

  const rejected = own
    .filter((o) => o.id !== chosenOptionId)
    .map((o) => {
      if (o.pruneReason && o.pruneReason.trim()) return { optionId: o.id, reason: o.pruneReason };
      const reason = o.cons.length
        ? `Not taken: ${joinList(o.cons.map(lowerFirst))}.`
        : `Not taken: ${chosen ? `${chosen.label} fit the constraints better` : 'another option fit better'}.`;
      return { optionId: o.id, reason };
    });

  return { rationale: parts.join(' '), rejected };
}

// What the UI calls: the same draft after the fake agent's think() delay.
export function draftRecord(
  decision: Decision,
  options: OptionNode[],
  chosenOptionId: string,
  summary: string,
  contextItems: ContextItem[],
): Promise<RecordDraft> {
  return think(draftRecordNow(decision, options, chosenOptionId, summary, contextItems));
}
