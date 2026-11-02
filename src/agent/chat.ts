// F-12, F-13 and AI search: the scripted agent that answers when no LLM is
// configured. It reads the PM's decisions, options, outcomes and teammates and
// answers a few kinds of question (why, who, what's due, what's open, what's
// related, how do these options compare). The UI labels every answer from here
// "Sample answer", so the team can see what the real LLM still has to cover.
import { formatDate } from '../features/log/format';
import { chosenLabel, decisionDate, inboxItems, linksOf, mapStatus, ownerOf } from '../store/dashboard';
import type { AppState, Citation, Decision, OptionNode } from '../types';
import { tokenize } from './brief';

export interface ChatScope {
  decisionId?: string;
  optionId?: string;
}

export interface AgentReply {
  text: string;
  citations: Citation[];
}

const cite = (d: Decision): Citation => ({ decisionId: d.id, label: d.question });

// Tags and names are free text; never let them act as regex syntax.
const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

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

function line(d: Decision, state: AppState): string {
  const chosen = chosenLabel(d, state);
  const owner = ownerOf(d, state);
  const who = owner ? `${owner.name.split(' ')[0]}, ` : '';
  return `• ${d.question} ${chosen ? `— chose “${chosen}”` : '— still open'} (${who}${formatDate(decisionDate(d))})`;
}

function list(intro: string, decisions: Decision[], state: AppState): AgentReply {
  const shown = decisions.slice(0, 5);
  const more = decisions.length > shown.length ? `\n…and ${decisions.length - shown.length} more on the map.` : '';
  return { text: `${intro}\n${shown.map((d) => line(d, state)).join('\n')}${more}`, citations: shown.map(cite) };
}

function explain(d: Decision, state: AppState, today: string): AgentReply {
  const chosen = chosenLabel(d, state);
  if (!chosen) {
    return {
      text: `“${d.question}” is still open. ${d.notes ? `What's known so far: ${d.notes}` : ''}`.trim(),
      citations: [cite(d)],
    };
  }
  const owner = ownerOf(d, state);
  const parts = [
    `${owner ? `${owner.name} ` : ''}chose “${chosen}” for “${d.question}” on ${formatDate(decisionDate(d))}.`,
    d.rationale ? `Why: ${d.rationale}` : '',
    ...notTaken(d, state).map((o) => `Passed on “${o.label}”: ${o.pruneReason ?? 'no reason recorded'}`),
  ];
  const outcome = state.outcomes.find((o) => o.decisionId === d.id);
  if (outcome) parts.push(`Outcome: ${outcome.summary}${outcome.metrics ? ` (${outcome.metrics})` : ''}`);
  else if (mapStatus(d, state, today) === 'outcome-due') parts.push('Its outcome is due and hasn’t been logged yet.');
  const { buildsOn } = linksOf(d.id, state);
  const parents = buildsOn.map((l) => state.decisions.find((x) => x.id === l.fromId)).filter(Boolean) as Decision[];
  if (parents.length) parts.push(`It builds on “${parents[0].question}”.`);
  return { text: parts.filter(Boolean).join('\n'), citations: [cite(d), ...parents.slice(0, 1).map(cite)] };
}

function generalReply(question: string, state: AppState, today: string): AgentReply {
  const q = question.toLowerCase();

  const mate = state.teammates.find(
    (t) => t.id !== state.user?.id && q.includes(t.name.split(' ')[0].toLowerCase()),
  );
  if (mate) {
    const theirs = state.decisions
      .filter((d) => d.ownerId === mate.id)
      .sort((a, b) => decisionDate(b).localeCompare(decisionDate(a)));
    const first = mate.name.split(' ')[0];
    const topic = rankDecisions(question.replace(new RegExp(escapeRegExp(first), 'ig'), ''), state).filter((d) => d.ownerId === mate.id);
    if (topic.length && topic.length < theirs.length) return list(`Here's what ${first} decided on that:`, topic, state);
    if (theirs.length === 0) return { text: `${first} hasn't logged any decisions yet.`, citations: [] };
    return list(`${mate.name} (${mate.role}) has made ${theirs.length} decisions:`, theirs, state);
  }

  if (/\b(due|overdue|outcome|outcomes|review|follow.?up)\b/.test(q)) {
    const due = state.decisions.filter((d) => mapStatus(d, state, today) === 'outcome-due');
    if (due.length === 0) return { text: 'No outcomes are due right now.', citations: [] };
    return list('These decisions passed their review date without an outcome:', due, state);
  }

  if (/\b(open|pending|in progress|waiting|upcoming|coming up|next|need to decide|to decide)\b/.test(q)) {
    const open = state.decisions.filter((d) => d.status !== 'decided' && !d.speculative);
    const spotted = state.suggestions.filter((s) => s.status === 'new');
    const reply = open.length ? list('Still open:', open, state) : { text: 'Nothing is open right now.', citations: [] };
    if (spotted.length) {
      reply.text += `\n\nRooted also spotted ${spotted.length} decision${spotted.length === 1 ? '' : 's'} you may need to make:\n${spotted
        .map((s) => `• ${s.question}`)
        .join('\n')}`;
    }
    return reply;
  }

  if (/\b(start|new) (a )?decision\b/.test(q)) {
    return {
      text: 'Use “Start a new decision” below. Write the question, and I’ll gather context from your allowed Slack channels and past decisions, then help you map the options.',
      citations: [],
    };
  }

  const tag = [...new Set(state.decisions.flatMap((d) => (d.tags ?? []).map((t) => t.label)))].find((t) =>
    new RegExp(`(^|[^a-z])#?${escapeRegExp(t)}([^a-z]|$)`).test(q),
  );
  const ranked = rankDecisions(question, state);
  if (tag && !/\b(why|reason)\b/.test(q)) {
    const tagged = state.decisions
      .filter((d) => d.tags?.some((t) => t.label === tag))
      .sort((a, b) => decisionDate(b).localeCompare(decisionDate(a)));
    return list(`Decisions tagged #${tag}:`, tagged, state);
  }

  if (ranked.length === 0) {
    return {
      text: 'I couldn’t find a decision about that. Try a teammate’s name, a tag like #pricing, “what’s due”, or words from the decision itself.',
      citations: [],
    };
  }
  if (/\b(why|reason|rationale|chose|choose|pick|picked|decide|decided)\b/.test(q) || ranked.length === 1) {
    return explain(ranked[0], state, today);
  }
  return list('These look related:', ranked, state);
}

function decisionReply(question: string, d: Decision, state: AppState): AgentReply {
  const q = question.toLowerCase();
  const options = state.options.filter((o) => o.decisionId === d.id);
  const open = options.filter((o) => o.state === 'open');
  const gaps = state.gaps.filter((g) => g.decisionId === d.id && !g.answer);
  const evidence = state.contextItems.filter((c) => c.decisionId === d.id && !c.removed && !c.flaggedInaccurate);
  const related = [
    ...linksOf(d.id, state).buildsOn.map((l) => state.decisions.find((x) => x.id === l.fromId)),
    ...rankDecisions(d.question, state, d.id),
  ].filter((x, i, all): x is Decision => !!x && x.status === 'decided' && all.findIndex((y) => y?.id === x.id) === i);

  if (/\b(gap|gaps|missing|unknown|don't know|dont know)\b/.test(q)) {
    if (gaps.length === 0) return { text: 'No open gaps. Every question I flagged has an answer.', citations: [] };
    return { text: `Still missing:\n${gaps.map((g) => `• ${g.question}`).join('\n')}`, citations: [] };
  }

  if (/\b(past|before|similar|related|history|precedent)\b/.test(q)) {
    if (related.length === 0) return { text: 'I didn’t find a past decision that looks related.', citations: [] };
    return list('Past decisions that look related:', related, state);
  }

  if (/\b(compare|which|recommend|should|best|choose|pick|option|options)\b/.test(q) && open.length) {
    // Kept in tree order, not sorted by score: the agent lays out trade-offs, it doesn't rank.
    return {
      text: [
        'I won’t make the call, but here’s how the open branches compare:',
        ...open.map(
          (o) => `• ${o.label} (rough score ${o.score}): ${o.pros[0] ?? 'no pros listed'}; but ${o.cons[0] ?? 'no cons listed'}`,
        ),
        gaps.length ? `Before choosing, ${gaps.length} gap${gaps.length === 1 ? ' is' : 's are'} still open.` : '',
      ]
        .filter(Boolean)
        .join('\n'),
      citations: related.slice(0, 1).map(cite),
    };
  }

  if (/\b(risk|risks|wrong|fail|downside|worry)\b/.test(q) && open.length) {
    return {
      text: `The biggest risks I see:\n${open.map((o) => `• ${o.label}: ${o.cons.join('; ') || 'no cons listed yet'}`).join('\n')}`,
      citations: [],
    };
  }

  const next =
    d.status === 'decided'
      ? 'It’s logged. Ask me why it went this way, or what it led to.'
      : options.length === 0
        ? 'Next: check the evidence, then map the options.'
        : 'Next: prune what doesn’t fit, then choose a branch and log it.';
  return {
    text: [
      `Where “${d.question}” stands: ${evidence.length} context item${evidence.length === 1 ? '' : 's'}, ${gaps.length} open gap${gaps.length === 1 ? '' : 's'}, ${open.length} open option${open.length === 1 ? '' : 's'}.`,
      related[0] ? `Closest past decision: “${related[0].question}” — chose “${chosenLabel(related[0], state)}”.` : '',
      next,
    ]
      .filter(Boolean)
      .join('\n'),
    citations: related.slice(0, 1).map(cite),
  };
}

function optionReply(question: string, d: Decision, o: OptionNode, state: AppState): AgentReply {
  const q = question.toLowerCase();
  const evidence = state.contextItems.filter((c) => o.contextIds.includes(c.id) && !c.removed && !c.flaggedInaccurate);
  const past = o.linkedDecisionId ? state.decisions.find((x) => x.id === o.linkedDecisionId) : undefined;
  if (/\b(wrong|risk|fail|downside|against)\b/.test(q)) {
    return {
      text: `What could make “${o.label}” the wrong call:\n${o.cons.map((c) => `• ${c}`).join('\n') || '• No cons listed yet. Add the ones you can think of.'}\nWhat would you need to see to rule it out?`,
      citations: past ? [cite(past)] : [],
    };
  }
  return {
    text: [
      `“${o.label}”: ${o.summary}`,
      o.pros.length ? `For it: ${o.pros.join('; ')}.` : '',
      o.cons.length ? `Against it: ${o.cons.join('; ')}.` : '',
      evidence[0] ? `Evidence: ${evidence[0].author ? `${evidence[0].author} in ` : ''}${evidence[0].sourceLabel}: “${evidence[0].snippet}”` : 'No evidence is attached to this option yet.',
      past ? `It extends “${past.question}”, where the team chose “${chosenLabel(past, state)}”.` : '',
      o.state === 'pruned' ? `You pruned it: ${o.pruneReason}` : `It sits under “${d.question}”. What would make you prune it?`,
    ]
      .filter(Boolean)
      .join('\n'),
    citations: past ? [cite(past)] : [],
  };
}

export function scriptedReply(question: string, scope: ChatScope, state: AppState, today: string): AgentReply {
  const d = scope.decisionId ? state.decisions.find((x) => x.id === scope.decisionId) : undefined;
  const o = scope.optionId ? state.options.find((x) => x.id === scope.optionId) : undefined;
  if (d && o) return optionReply(question, d, o, state);
  if (d) return decisionReply(question, d, state);
  return generalReply(question, state, today);
}

/** Short starters shown above the chat box, per scope. */
export function suggestedPrompts(scope: ChatScope, state: AppState, today: string): string[] {
  if (scope.optionId) return ['What could make this wrong?', 'What evidence supports it?'];
  if (scope.decisionId) return ['How do the options compare?', 'What’s still missing?', 'Any related past decisions?'];
  const due = inboxItems(state, today).some((i) => i.kind === 'outcome-due');
  return [
    due ? 'What outcomes are due?' : 'What’s still open?',
    'Why did we choose the checklist?',
    'What has Rafael decided?',
  ];
}
