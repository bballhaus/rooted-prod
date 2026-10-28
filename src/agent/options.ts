// F-10: the fake agent's option generator. No LLM sits behind it: it picks a
// template from the decision question, fills it with the decision's notes,
// constraints and gaps, and cites only evidence the PM hasn't removed or
// flagged. Pure and deterministic, so the same inputs give the same branches.
import type { ContextItem, Decision, Gap, OptionNode } from '../types';
import { think } from './mockAgent';

interface Draft {
  key: string;
  label: string;
  summary: string;
  pros: string[];
  cons: string[];
  score: number;
  keywords: string[];
  defer?: boolean;
}

export type OptionTemplate = 'build-vs-buy' | 'x-or-y' | 'pricing' | 'now-vs-later' | 'generic';

const DETERMINERS = new Set(['a', 'an', 'the', 'our', 'their', 'one', 'two', 'three']);
const LEADERS = new Set(['per', 'by', 'to', 'with', 'in', 'on', 'via', 'through', 'from', 'as']);
// Words that end the second half of "X or Y" and start trailing context.
const TRAILING = /\s+(?:for|this|next|before|after|during|until|so|because|when|while|given|in q\d)\b.*$/i;

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function stripArticle(s: string): string {
  return s.replace(/^(?:a|an|the)\s+/i, '');
}

const STOP = new Set([
  'the',
  'and',
  'for',
  'our',
  'not',
  'use',
  'should',
  'with',
  'this',
  'that',
  'than',
  'from',
  'into',
  'over',
  'can',
  'are',
]);

function words(s: string): string[] {
  return s
    .toLowerCase()
    .split(/[^a-z0-9%$]+/)
    .filter((w) => w.length > 2 && !STOP.has(w));
}

/** Parses "checklist or a guided tour?"-style questions into the two sides. */
export function parseEitherOr(question: string): [string, string] | null {
  const q = question.trim().replace(/[?.!]+$/, '');
  const m = /^(.*\S)\s+or\s+(\S.*)$/i.exec(q);
  if (!m) return null;
  const left = m[1].split(/\s+/);
  let right = m[2].replace(TRAILING, '').trim();
  // "...or not?" / "...or later?" are yes/no questions, not two branches.
  if (/^(not|no|nothing|neither)$/i.test(right)) return null;
  const rightWords = right.split(/\s+/);
  const first = rightWords[0].toLowerCase();

  let start = -1;
  if (DETERMINERS.has(first) || LEADERS.has(first)) {
    const sameKind = DETERMINERS.has(first) ? DETERMINERS : new Set([first]);
    for (let i = left.length - 1; i >= 0; i--) {
      if (sameKind.has(left[i].toLowerCase())) {
        start = i;
        break;
      }
    }
  }
  if (start < 0) start = Math.max(1, left.length - rightWords.length);
  if (start >= left.length) start = left.length - 1;
  const x = left.slice(start).join(' ');
  right = rightWords.join(' ');
  if (!x || !right) return null;
  return [cap(stripArticle(x)), cap(stripArticle(right))];
}

export function pickTemplate(question: string): OptionTemplate {
  const q = question.toLowerCase();
  if (/\bbuild\b/.test(q) && /\b(buy|vendor|off[- ]the[- ]shelf|third[- ]party|partner|license)\b/.test(q))
    return 'build-vs-buy';
  if (parseEitherOr(question)) return 'x-or-y';
  if (/\b(pric(e|es|ing)|charge|discount|per seat|tier|plan|annual|monthly|paywall|free trial)\b/.test(q))
    return 'pricing';
  if (/\b(now|later|this quarter|next quarter|this sprint|delay|postpone|wait|ship .* (before|by))\b/.test(q))
    return 'now-vs-later';
  return 'generic';
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function constraintCon(decision: Decision, re: RegExp): string[] {
  const hit = decision.constraints.find((c) => re.test(c));
  return hit ? [`Pushes against your constraint: “${hit}”`] : [];
}

function deferDraft(decision: Decision, gaps: Gap[]): Draft {
  const open = gaps.filter((g) => !g.answer?.trim());
  const pros = ['Cheapest branch to take this week', 'Keeps every other branch open'];
  if (open.length) pros.unshift(`Answers an open question first: “${open[0].question}”`);
  const cons = ['Delays any impact on the metric you’re trying to move'];
  if (decision.deadline) cons.push(`Eats into the time before your ${decision.deadline} deadline`);
  return {
    key: 'defer',
    label: 'Gather more evidence first',
    summary: open.length
      ? `Hold the call for a week and close ${open.length === 1 ? 'the open question' : `the ${open.length} open questions`} in the brief.`
      : 'Hold the call for a week: run 5 customer calls or a small test before committing.',
    pros,
    cons,
    score: open.length ? 52 : 40,
    keywords: ['unclear', 'not sure', 'data', 'research', 'interview', 'ask', 'test'],
    defer: true,
  };
}

function drafts(decision: Decision, gaps: Gap[]): Draft[] {
  const template = pickTemplate(decision.question);
  switch (template) {
    case 'build-vs-buy':
      return [
        {
          key: 'build',
          label: 'Build it in-house',
          summary: 'The platform team builds a version shaped to Fernwave’s workflow.',
          pros: ['Full control over the experience', 'No per-seat vendor cost as accounts grow'],
          cons: ['Roughly two to three sprints of eng time', ...constraintCon(decision, /eng|headcount|engineer/i)],
          score: 58,
          keywords: ['build', 'eng', 'platform', 'sprint', 'in-house', 'custom'],
        },
        {
          key: 'buy',
          label: 'Buy a vendor tool',
          summary: 'License an off-the-shelf tool and integrate it this sprint.',
          pros: ['Live in days, not sprints', 'Vendor carries maintenance'],
          cons: [
            'Annual contract and per-seat fees',
            'Less control over the experience',
            ...constraintCon(decision, /budget|cost|\$/i),
          ],
          score: 64,
          keywords: ['vendor', 'buy', 'tool', 'contract', 'license', 'sdk'],
        },
        deferDraft(decision, gaps),
      ];
    case 'x-or-y': {
      const [x, y] = parseEitherOr(decision.question)!;
      return [
        {
          key: 'x',
          label: x,
          summary: `Go with ${x.toLowerCase()} and measure it against the goal in your notes.`,
          pros: [`Directly answers the “${x.toLowerCase()}” side of the question`, 'Clear to explain to the team'],
          cons: [`Gives up what ${y.toLowerCase()} would offer`],
          score: 0,
          keywords: words(x),
        },
        {
          key: 'y',
          label: y,
          summary: `Go with ${y.toLowerCase()} and measure it against the goal in your notes.`,
          pros: [`Directly answers the “${y.toLowerCase()}” side of the question`, 'Clear to explain to the team'],
          cons: [`Gives up what ${x.toLowerCase()} would offer`],
          score: 0,
          keywords: words(y),
        },
        deferDraft(decision, gaps),
      ];
    }
    case 'pricing':
      return [
        {
          key: 'keep',
          label: 'Keep current pricing',
          summary: 'Leave the price as is and fix packaging copy on the pricing page.',
          pros: ['No risk to existing revenue', 'No migration for current customers'],
          cons: ['Doesn’t address the objection sales keeps hearing'],
          score: 46,
          keywords: ['current', 'existing', 'churn', 'revenue'],
        },
        {
          key: 'change',
          label: 'Change the price for new customers',
          summary: 'Ship the new price to new signups only; grandfather existing accounts for 12 months.',
          pros: ['Tests the new price without upsetting current accounts', 'Easy to roll back'],
          cons: ['Two price books to support for a year', ...constraintCon(decision, /free|starter|plan/i)],
          score: 63,
          keywords: ['price', 'pricing', 'seat', 'plan', 'sales', 'deal'],
        },
        {
          key: 'test',
          label: 'Run a 4-week pricing test',
          summary: 'Split new trials 50/50 between the current and new price and compare paid conversion.',
          pros: ['Real conversion data before committing'],
          cons: ['Needs ~400 trials per arm to read clearly', 'Prospects may compare notes'],
          score: 55,
          keywords: ['test', 'experiment', 'trial', 'conversion'],
        },
      ];
    case 'now-vs-later':
      return [
        {
          key: 'now',
          label: 'Do it now',
          summary: 'Pull it into the current cycle and cut scope elsewhere to fit.',
          pros: ['Gets the impact this quarter', 'Answers the customers who asked'],
          cons: ['Bumps something already planned', ...constraintCon(decision, /eng|headcount|engineer|one /i)],
          score: 57,
          keywords: ['now', 'asap', 'asked', 'customer', 'deal', 'urgent'],
        },
        {
          key: 'later',
          label: 'Plan it for next quarter',
          summary: 'Add it to next quarter’s roadmap and tell the requesters the date.',
          pros: ['Keeps this quarter’s plan intact', 'Time to scope it properly'],
          cons: ['Risk of losing the deals that are waiting on it'],
          score: 61,
          keywords: ['later', 'roadmap', 'quarter', 'plan', 'capacity'],
        },
        deferDraft(decision, gaps),
      ];
    case 'generic':
      return [
        {
          key: 'go',
          label: 'Go ahead as proposed',
          summary: 'Commit to the change in your question and set a review date to check the metric.',
          pros: ['Moves fastest', 'Builds on what the team already discussed'],
          cons: ['Commits before every open question is answered', ...constraintCon(decision, /eng|headcount|budget/i)],
          score: 60,
          keywords: words(decision.question),
        },
        {
          key: 'small',
          label: 'Ship a smaller version first',
          summary: 'Cut it to the one piece customers mention most and ship that behind a flag.',
          pros: ['Learn in two weeks instead of a quarter', 'Easy to roll back'],
          cons: ['May be too small to move the metric'],
          score: 56,
          keywords: ['small', 'mvp', 'flag', 'pilot', 'beta'],
        },
        deferDraft(decision, gaps),
      ];
  }
}

/** Evidence the agent may cite: this decision's items the PM hasn't removed or flagged. */
export function citableContext(decisionId: string, contextItems: ContextItem[]): ContextItem[] {
  return contextItems.filter((c) => c.decisionId === decisionId && !c.removed && !c.flaggedInaccurate);
}

/**
 * F-10: 2–4 top-level options for a decision. Pure and deterministic: ids are
 * derived from the decision id, scores from the evidence each option cites.
 */
export function generateOptions(decision: Decision, contextItems: ContextItem[], gaps: Gap[]): OptionNode[] {
  const valid = citableContext(decision.id, contextItems);
  const decisionGaps = gaps.filter((g) => g.decisionId === decision.id);
  const list = drafts(decision, decisionGaps).slice(0, 4);

  // Cite items whose text mentions an option's keywords; spread the rest
  // across the non-defer options so each concrete branch has some evidence.
  const cites = new Map<string, string[]>(list.map((d) => [d.key, []]));
  const unmatched: ContextItem[] = [];
  const mentions = (text: string) =>
    list.find((d) => d.keywords.some((k) => k && text.toLowerCase().includes(k.toLowerCase())));
  for (const item of valid) {
    // The snippet is the strongest signal; fall back to the theme and source.
    const match = mentions(item.snippet) ?? mentions(`${item.group} ${item.sourceLabel}`);
    if (match) cites.get(match.key)!.push(item.id);
    else unmatched.push(item);
  }
  const concrete = list.filter((d) => !d.defer);
  unmatched.forEach((item, i) => cites.get(concrete[i % concrete.length].key)!.push(item.id));

  const h = hash(decision.question);
  return list.map((d, i) => {
    const contextIds = cites.get(d.key)!;
    const base = d.score || 55 + ((h >> (i * 3)) % 9) - i * 2;
    const score = Math.max(5, Math.min(95, base + Math.min(contextIds.length, 3) * 4));
    return {
      id: `o-${decision.id}-${i + 1}`,
      decisionId: decision.id,
      parentId: null,
      label: d.label,
      summary: d.summary,
      pros: d.pros,
      cons: d.cons,
      score,
      contextIds,
      state: 'open',
    };
  });
}

/** The same, behind the fake agent's thinking delay. */
export function fetchOptions(
  decision: Decision,
  contextItems: ContextItem[],
  gaps: Gap[],
  ms?: number,
): Promise<OptionNode[]> {
  return think(generateOptions(decision, contextItems, gaps), ms);
}
