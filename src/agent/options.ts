// F-10: the fake agent's option generator. No LLM sits behind it: it picks a
// template from the decision question, fills it with the decision's notes,
// constraints and gaps, and cites only evidence the PM hasn't removed or
// flagged. Pure and deterministic, so the same inputs give the same branches.
import { childrenOf, depthOf } from '../store/tree';
import type { ContextItem, Criteria, Decision, Gap, OptionNode } from '../types';
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
  effort?: number; // 1–5, lower is easier
  risk?: number; // 1–5, lower is safer
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
    effort: 1,
    risk: 1,
  };
}

function drafts(decision: Decision, gaps: Gap[]): Draft[] {
  const template = pickTemplate(decision.question);
  switch (template) {
    case 'build-vs-buy':
      return [
        {
          key: 'build',
          effort: 4,
          risk: 3,
          label: 'Build it in-house',
          summary: 'The platform team builds a version shaped to Fernwave’s workflow.',
          pros: ['Full control over the experience', 'No per-seat vendor cost as accounts grow'],
          cons: ['Roughly two to three sprints of eng time', ...constraintCon(decision, /eng|headcount|engineer/i)],
          score: 58,
          keywords: ['build', 'eng', 'platform', 'sprint', 'in-house', 'custom'],
        },
        {
          key: 'buy',
          effort: 2,
          risk: 3,
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
          effort: 1,
          risk: 1,
          label: 'Keep current pricing',
          summary: 'Leave the price as is and fix packaging copy on the pricing page.',
          pros: ['No risk to existing revenue', 'No migration for current customers'],
          cons: ['Doesn’t address the objection sales keeps hearing'],
          score: 46,
          keywords: ['current', 'existing', 'churn', 'revenue'],
        },
        {
          key: 'change',
          effort: 3,
          risk: 3,
          label: 'Change the price for new customers',
          summary: 'Ship the new price to new signups only; grandfather existing accounts for 12 months.',
          pros: ['Tests the new price without upsetting current accounts', 'Easy to roll back'],
          cons: ['Two price books to support for a year', ...constraintCon(decision, /free|starter|plan/i)],
          score: 63,
          keywords: ['price', 'pricing', 'seat', 'plan', 'sales', 'deal'],
        },
        {
          key: 'test',
          effort: 3,
          risk: 2,
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
          effort: 4,
          risk: 3,
          label: 'Do it now',
          summary: 'Pull it into the current cycle and cut scope elsewhere to fit.',
          pros: ['Gets the impact this quarter', 'Answers the customers who asked'],
          cons: ['Bumps something already planned', ...constraintCon(decision, /eng|headcount|engineer|one /i)],
          score: 57,
          keywords: ['now', 'asap', 'asked', 'customer', 'deal', 'urgent'],
        },
        {
          key: 'later',
          effort: 2,
          risk: 2,
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
          effort: 3,
          risk: 3,
          label: 'Go ahead as proposed',
          summary: 'Commit to the change in your question and set a review date to check the metric.',
          pros: ['Moves fastest', 'Builds on what the team already discussed'],
          cons: ['Commits before every open question is answered', ...constraintCon(decision, /eng|headcount|budget/i)],
          score: 60,
          keywords: words(decision.question),
        },
        {
          key: 'small',
          effort: 2,
          risk: 2,
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

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, Math.round(n)));
}

/** Rough 1–5 ratings: impact follows the score, evidence follows what's cited. */
function rate(score: number, cited: number, effort: number, risk: number): Criteria {
  return {
    impact: clamp(score / 20, 1, 5),
    effort: clamp(effort, 1, 5),
    risk: clamp(risk, 1, 5),
    evidence: clamp(1 + cited, 1, 5),
  };
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
    const effort = d.effort ?? 2 + ((h >> (i + 5)) % 3);
    const risk = d.risk ?? 2 + ((h >> (i + 9)) % 3);
    return {
      id: `o-${decision.id}-${i + 1}`,
      decisionId: decision.id,
      parentId: null,
      label: d.label,
      summary: d.summary,
      pros: d.pros,
      cons: d.cons,
      score,
      criteria: rate(d.defer ? Math.min(score, 30) : score, contextIds.length, effort, risk),
      contextIds,
      state: 'open',
    };
  });
}

interface SubDraft {
  label: string;
  summary: (parent: string) => string;
  pros: string[];
  cons: string[];
  // Nudges against the parent branch's ratings and score.
  impact: number;
  effort: number;
  risk: number;
  score: number;
}

// Each level of the tree splits a branch along a different dimension:
// how widely to roll it out, then when, then for whom, then how to measure it.
const SPLITS: { name: string; subs: SubDraft[] }[] = [
  {
    name: 'rollout',
    subs: [
      {
        label: 'Pilot with 5 design partners',
        summary: (p) => `${p}, tried first with 5 design-partner accounts for two weeks.`,
        pros: ['Real feedback before a wide launch', 'Easy to roll back'],
        cons: ['Small sample; results may not hold for self-serve teams'],
        impact: -1,
        effort: -1,
        risk: -2,
        score: -4,
      },
      {
        label: 'All new signups',
        summary: (p) => `${p} for every workspace created from launch day.`,
        pros: ['Clean before/after read on activation', 'Existing customers aren’t disrupted'],
        cons: ['Takes a full signup cohort to read'],
        impact: 0,
        effort: 0,
        risk: -1,
        score: 2,
      },
      {
        label: 'Everyone, behind a flag',
        summary: (p) => `${p} for all workspaces, behind a feature flag the team can turn off.`,
        pros: ['Fastest path to full impact'],
        cons: ['Support load lands all at once', 'Harder to tell what caused a change'],
        impact: 1,
        effort: 1,
        risk: 1,
        score: 0,
      },
    ],
  },
  {
    name: 'timing',
    subs: [
      {
        label: 'Start this sprint',
        summary: (p) => `${p}, starting in the current sprint.`,
        pros: ['Impact lands this quarter'],
        cons: ['Bumps something already planned'],
        impact: 1,
        effort: 1,
        risk: 1,
        score: 1,
      },
      {
        label: 'After the next big release',
        summary: (p) => `${p}, once the team’s next big release is out.`,
        pros: ['Doesn’t compete with that release for eng time'],
        cons: ['Impact lands later'],
        impact: 0,
        effort: -1,
        risk: -1,
        score: -1,
      },
    ],
  },
  {
    name: 'audience',
    subs: [
      {
        label: 'Team plan only',
        summary: (p) => `${p}, for Team plan workspaces only.`,
        pros: ['Targets the accounts with the most seats to grow'],
        cons: ['Starter teams don’t see it'],
        impact: 0,
        effort: 0,
        risk: -1,
        score: 1,
      },
      {
        label: 'All plans',
        summary: (p) => `${p}, for Starter and Team plans alike.`,
        pros: ['One experience to support'],
        cons: ['Free workspaces add support load'],
        impact: 1,
        effort: 0,
        risk: 1,
        score: -1,
      },
    ],
  },
  {
    name: 'measure',
    subs: [
      {
        label: 'Judge it on activation',
        summary: (p) => `${p}, judged on the activation metric your team already tracks.`,
        pros: ['Reads within a week of launch'],
        cons: ['Says little about revenue'],
        impact: 0,
        effort: 0,
        risk: 0,
        score: 0,
      },
      {
        label: 'Judge it on trial-to-paid',
        summary: (p) => `${p}, judged on trial-to-paid conversion for the next cohort.`,
        pros: ['Tied to revenue'],
        cons: ['Takes a full trial cycle to read'],
        impact: 0,
        effort: 0,
        risk: 0,
        score: 0,
      },
    ],
  },
];

const EVIDENCE_STEPS: SubDraft[] = [
  {
    label: 'Run 5 customer calls',
    summary: () => 'Book five calls with admins from recent trials and ask about this decision directly.',
    pros: ['Answers “why”, not just “what”'],
    cons: ['A week of calendar time'],
    impact: 0,
    effort: 1,
    risk: 0,
    score: 2,
  },
  {
    label: 'Pull the numbers first',
    summary: () => 'Pull the numbers behind the open questions in your brief before choosing.',
    pros: ['Cheap and fast'],
    cons: ['Numbers alone won’t explain the cause'],
    impact: 0,
    effort: -1,
    risk: 0,
    score: 0,
  },
];

/** Which dimension a branch at this depth splits along. */
export function splitFor(depth: number): string {
  return SPLITS[depth % SPLITS.length].name;
}

/**
 * F-10: sub-options for one branch. Deterministic: the split depends on how deep
 * the branch sits, and the sub-options inherit (and nudge) its ratings and evidence.
 */
export function generateSubOptions(
  decision: Decision,
  parent: OptionNode,
  all: OptionNode[],
  contextItems: ContextItem[],
): OptionNode[] {
  const own = all.filter((o) => o.decisionId === decision.id);
  const depth = depthOf(own, parent.id);
  const isDefer = parent.parentId === null && /gather more evidence/i.test(parent.label);
  const subs = isDefer ? EVIDENCE_STEPS : SPLITS[depth % SPLITS.length].subs;
  const valid = new Set(citableContext(decision.id, contextItems).map((c) => c.id));
  const evidence = parent.contextIds.filter((id) => valid.has(id));
  const base = parent.criteria ?? {};
  const taken = new Set(own.map((o) => o.id));
  const start = childrenOf(own, parent.id).length;

  return subs.map((sub, i) => {
    let n = start + i + 1;
    // Own namespace: a sub-option under the PM's option is still agent output,
    // so it must not inherit the `o-user-` prefix.
    const stem = `o-sub-${parent.id.replace(/^o-/, '')}`;
    while (taken.has(`${stem}-${n}`)) n++;
    const id = `${stem}-${n}`;
    taken.add(id);
    const contextIds = evidence.filter((_, j) => j % subs.length === i || evidence.length <= 1);
    const score = clamp((parent.score || 55) + sub.score, 5, 95);
    return {
      id,
      decisionId: decision.id,
      parentId: parent.id,
      label: sub.label,
      summary: sub.summary(parent.label),
      pros: sub.pros,
      cons: sub.cons,
      score,
      criteria: {
        impact: clamp((base.impact ?? 3) + sub.impact, 1, 5),
        effort: clamp((base.effort ?? 3) + sub.effort, 1, 5),
        risk: clamp((base.risk ?? 3) + sub.risk, 1, 5),
        evidence: clamp(1 + contextIds.length, 1, 5),
      },
      contextIds,
      state: 'open',
    };
  });
}

/** The same, behind the fake agent's thinking delay. */
export function fetchSubOptions(
  decision: Decision,
  parent: OptionNode,
  all: OptionNode[],
  contextItems: ContextItem[],
  ms?: number,
): Promise<OptionNode[]> {
  return think(generateSubOptions(decision, parent, all, contextItems), ms);
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
