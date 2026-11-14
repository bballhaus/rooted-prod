// Search for the header box and the map (F-17): ranks decisions by how well
// their words match a query. Plain keyword matching, not AI.
import { chosenLabel, decisionDate, ownerOf } from './dashboard';
import type { AppState, Decision, OptionNode } from '../types';

const STOPWORDS = new Set([
  'about', 'after', 'again', 'also', 'before', 'being', 'build', 'could', 'does', 'from', 'have', 'into',
  'just', 'like', 'make', 'more', 'most', 'much', 'need', 'only', 'other', 'over', 'should', 'some',
  'than', 'that', 'their', 'them', 'then', 'there', 'they', 'this', 'what', 'when', 'which', 'will',
  'with', 'would', 'your', 'ours', 'were', 'week', 'weeks', 'quarter', 'next', 'first',
]);

export function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((w) => w.length >= 3 && !STOPWORDS.has(w));
}

function notTaken(d: Decision, state: AppState): OptionNode[] {
  return state.options.filter((o) => o.decisionId === d.id && o.state === 'pruned');
}

// Words that frame a question rather than say what it's about, plus short
// fillers the brief's tokenizer keeps.
const QUESTION_WORDS = new Set([
  'why', 'did', 'choose', 'chose', 'pick', 'picked', 'decide', 'decided', 'who', 'how', 'the', 'for', 'and',
  'are', 'our', 'was', 'has', 'you', 'can', 'any', 'all', 'not', 'but', 'its', 'show', 'decisions', 'decision',
]);

// Where a word shows up matters: the question, the choice and the tags say
// what a decision is about; the rest only mentions things.
function fields(d: Decision, state: AppState): [string, number][] {
  const strong = [d.question, chosenLabel(d, state), ...(d.tags ?? []).map((t) => t.label)];
  const weak = [
    d.summary,
    d.rationale,
    d.notes,
    ownerOf(d, state)?.name,
    ...notTaken(d, state).flatMap((o) => [o.label, o.pruneReason]),
  ];
  return [
    [strong.filter(Boolean).join(' ').toLowerCase(), 2],
    [weak.filter(Boolean).join(' ').toLowerCase(), 1],
  ];
}

/** Decisions ranked by how strongly they match the question's words. */
export function rankDecisions(question: string, state: AppState, exclude?: string): Decision[] {
  const words = tokenize(question).filter((w) => !QUESTION_WORDS.has(w));
  if (words.length === 0) return [];
  return state.decisions
    .filter((d) => d.id !== exclude)
    .map((d) => {
      const parts = fields(d, state);
      const score = words.reduce((sum, w) => {
        const stem = w.slice(0, Math.max(4, w.length - 2));
        return sum + parts.reduce((s, [text, weight]) => s + (text.includes(stem) ? weight : 0), 0);
      }, 0);
      return { d, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || decisionDate(b.d).localeCompare(decisionDate(a.d)))
    .map((x) => x.d);
}

