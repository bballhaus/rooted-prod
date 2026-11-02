// F-06 / F-09: the fake agent that gathers an evidence brief for a decision.
// No LLM: it keyword-matches the decision against the synthetic corpus in
// src/data/slackCorpus.ts. It only ever reads connected sources and the
// channels or folders the PM allowed (F-02); blocked ones are skipped before
// any matching happens.
import { driveCorpus, slackCorpus, THEME_LABELS, type Theme } from '../data/slackCorpus';
import type { AppState, Channel, ContextItem, Decision, Gap, Source } from '../types';
import { think } from './mockAgent';

export const PAST_DECISIONS_GROUP = 'Past decisions';
export const USER_NOTES_GROUP = 'Your notes';
export const RECENT_GROUP = 'Recent activity';

const MAX_SOURCE_ITEMS = 10;
const FALLBACK_ITEMS = 4;

const STOPWORDS = new Set([
  'about', 'after', 'again', 'also', 'before', 'being', 'build', 'could', 'does', 'from', 'have', 'into',
  'just', 'like', 'make', 'more', 'most', 'much', 'need', 'only', 'other', 'over', 'should', 'some',
  'than', 'that', 'their', 'them', 'then', 'there', 'they', 'this', 'what', 'when', 'which', 'will',
  'with', 'would', 'your', 'ours', 'were', 'week', 'weeks', 'quarter', 'next', 'first',
]);

export function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((w) => w.length >= 3 && !STOPWORDS.has(w));
}

// A loose match so "activate" finds "activation" and "trials" finds "trial".
function wordsMatch(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.length >= 5 && b.length >= 5) return a.slice(0, 5) === b.slice(0, 5);
  return false;
}

function score(queryTokens: string[], keywords: string[]): number {
  return keywords.reduce((n, k) => n + (queryTokens.some((t) => wordsMatch(t, k)) ? 1 : 0), 0);
}

function decisionQuery(decision: Decision): string[] {
  return tokenize([decision.question, decision.notes, ...decision.constraints].join(' '));
}

export interface SourceAccess {
  read: string[]; // labels the agent read, e.g. "#growth"
  excluded: { label: string; reason: string }[];
}

function allowedChannels(source: Source | undefined): Channel[] {
  if (!source || !source.connected) return [];
  return source.channels.filter((c) => c.allowed);
}

// What the brief may read, and what it skipped and why. Shown on the page.
export function describeSourceAccess(state: AppState): SourceAccess {
  const read: string[] = [];
  const excluded: SourceAccess['excluded'] = [];
  for (const source of state.sources) {
    if (!source.connected) {
      excluded.push({ label: source.name, reason: 'not connected' });
      continue;
    }
    for (const c of source.channels) {
      const label = source.type === 'google-drive' ? `Drive: ${c.name}` : c.name;
      if (c.allowed) read.push(label);
      else excluded.push({ label, reason: 'not allowed' });
    }
  }
  read.push('Your past decisions');
  return { read, excluded };
}

function topTheme(items: { theme: Theme; score: number }[]): Theme | undefined {
  const totals = new Map<Theme, number>();
  for (const i of items) totals.set(i.theme, (totals.get(i.theme) ?? 0) + i.score);
  let best: Theme | undefined;
  let bestScore = 0;
  for (const [theme, s] of totals) {
    if (s > bestScore) {
      best = theme;
      bestScore = s;
    }
  }
  return best;
}

// Themes inferred straight from the question, used for gaps even when no
// allowed message matched. A fixed word list, so blocked content is never read.
const THEME_WORDS: Record<Theme, string[]> = {
  onboarding: ['onboarding', 'checklist', 'setup', 'tour'],
  activation: ['activation', 'activate', 'aha'],
  pricing: ['pricing', 'price', 'seat', 'seats', 'plan', 'packaging', 'annual', 'discount'],
  trials: ['trial', 'trials', 'conversion', 'convert'],
  notifications: ['notification', 'notifications', 'push', 'digest', 'email'],
  churn: ['churn', 'retention', 'retain', 'cancel', 'cancellation'],
  sso: ['sso', 'saml', 'okta', 'security', 'enterprise'],
  referrals: ['referral', 'referrals', 'invite', 'viral'],
  dashboard: ['dashboard', 'redesign', 'widgets', 'home'],
};

function themesForQuery(queryTokens: string[]): Theme[] {
  return (Object.keys(THEME_WORDS) as Theme[]).filter((t) => score(queryTokens, THEME_WORDS[t]) > 0);
}

const METRIC_GAPS: Record<Theme, string> = {
  onboarding: 'What setup completion rate would make this worth it? The brief has funnel numbers but no target.',
  activation: 'Which activation definition should this be judged on: 3+ teammates in 7 days, or a shared board?',
  pricing: 'What revenue or conversion change would make a pricing change worth the billing work?',
  trials: 'What trial-to-paid rate are you aiming for? The brief only has today\'s 11.4%.',
  notifications: 'How will you measure success here: digest opens, return visits, or fewer unsubscribes?',
  churn: 'Which churn number matters for this call: Starter logo churn or net revenue retention?',
  sso: 'How much Enterprise pipeline actually depends on SSO? Only two accounts are named in allowed channels.',
  referrals: 'What share of new workspaces should come from referrals for this to be worth building?',
  dashboard: 'What usage target would show the redesign worked? No baseline was found in allowed channels.',
};

// Blocked channels that usually carry signal for a theme. The agent never
// reads them; it only names them so the PM can decide.
const LIKELY_BLOCKED: Partial<Record<Theme, string[]>> = {
  pricing: ['ch-sales', 'ch-leadership'],
  trials: ['ch-sales'],
  sso: ['ch-sales'],
  churn: ['ch-leadership', 'ch-sales'],
  referrals: ['ch-sales'],
};

function buildGaps(decision: Decision, state: AppState, themes: Theme[]): Gap[] {
  const questions: string[] = [];
  const main = themes[0];
  const hasNumber = /\d/.test(`${decision.question} ${decision.notes}`);

  if (main) questions.push(METRIC_GAPS[main]);
  else if (!hasNumber) questions.push('What metric would tell you this decision worked, and what is it today?');

  const slack = state.sources.find((s) => s.type === 'slack');
  if (slack?.connected) {
    const blockedIds = new Set(slack.channels.filter((c) => !c.allowed).map((c) => c.id));
    const named = new Set<string>();
    for (const t of themes) for (const id of LIKELY_BLOCKED[t] ?? []) if (blockedIds.has(id)) named.add(id);
    const first = [...named][0];
    const channel = slack.channels.find((c) => c.id === first);
    if (channel) {
      questions.push(
        `${channel.name} isn't in your allowed channels, so Rooted didn't read it. Threads there often cover ${
          THEME_LABELS[main ?? 'pricing'].toLowerCase()
        }. Is there anything from it that should count?`,
      );
    }
  } else {
    questions.push('Slack isn\'t connected, so no team messages were read. What have you heard from the team?');
  }

  const drive = state.sources.find((s) => s.type === 'google-drive');
  if (drive && !drive.connected) {
    questions.push(
      'Google Drive isn\'t connected, so PRDs and research docs weren\'t read. Is there a spec or study that should be in this brief?',
    );
  }

  if (decision.constraints.length === 0) {
    questions.push('What limits this call: a deadline, engineering capacity, or a revenue target?');
  } else if (!decision.deadline) {
    questions.push('When does this need to be decided by? No deadline is set.');
  }

  if (questions.length < 2) {
    questions.push('Who else has a stake in this decision, and what would change their mind?');
  }

  return questions.slice(0, 4).map((question, i) => ({
    id: `${decision.id}-gap-${i + 1}`,
    decisionId: decision.id,
    question,
  }));
}

// Pure, synchronous version of the agent, for tests and for gatherBrief.
export function buildBrief(decision: Decision, state: AppState): { items: ContextItem[]; gaps: Gap[] } {
  const query = decisionQuery(decision);
  const slack = state.sources.find((s) => s.type === 'slack');
  const drive = state.sources.find((s) => s.type === 'google-drive');
  const channels = new Map(allowedChannels(slack).map((c) => [c.id, c]));
  const folders = new Map(allowedChannels(drive).map((c) => [c.id, c]));

  // Only allowed, connected sources are ever considered.
  const readableSlack = slackCorpus.filter((m) => channels.has(m.channelId));
  const readableDrive = driveCorpus.filter((d) => folders.has(d.folderId));

  type Candidate = { item: ContextItem; theme: Theme; score: number };
  const candidates: Candidate[] = [];
  for (const m of readableSlack) {
    const s = score(query, m.keywords);
    if (s === 0) continue;
    candidates.push({
      theme: m.theme,
      score: s,
      item: {
        id: `${decision.id}-${m.id}`,
        decisionId: decision.id,
        origin: 'slack',
        sourceLabel: channels.get(m.channelId)!.name,
        author: m.author,
        date: m.date,
        snippet: m.text,
        group: THEME_LABELS[m.theme],
        flaggedInaccurate: false,
        userEdited: false,
        removed: false,
      },
    });
  }
  for (const d of readableDrive) {
    const s = score(query, d.keywords);
    if (s === 0) continue;
    candidates.push({
      theme: d.theme,
      score: s,
      item: {
        id: `${decision.id}-${d.id}`,
        decisionId: decision.id,
        origin: 'drive',
        sourceLabel: d.title,
        author: d.author,
        date: d.date,
        snippet: d.text,
        group: THEME_LABELS[d.theme],
        flaggedInaccurate: false,
        userEdited: false,
        removed: false,
      },
    });
  }
  candidates.sort((a, b) => b.score - a.score || b.item.date.localeCompare(a.item.date));
  const matched = candidates.slice(0, MAX_SOURCE_ITEMS);

  const items: ContextItem[] = matched.map((c) => c.item);

  // Past decisions that were logged and share words with this one.
  for (const past of state.decisions) {
    if (past.id === decision.id || past.status !== 'decided') continue;
    const pastTokens = tokenize([past.question, past.summary ?? '', past.notes].join(' '));
    const overlap = query.filter((t) => pastTokens.some((p) => wordsMatch(t, p))).length;
    if (overlap < 1) continue;
    items.push({
      id: `${decision.id}-past-${past.id}`,
      decisionId: decision.id,
      origin: 'past-decision',
      sourceLabel: `Past decision: ${past.question}`,
      author: state.user?.name,
      date: (past.loggedAt ?? past.createdAt).slice(0, 10),
      snippet: [past.summary, past.rationale].filter(Boolean).join(' '),
      link: `/decisions/${past.id}`,
      group: PAST_DECISIONS_GROUP,
      flaggedInaccurate: false,
      userEdited: false,
      removed: false,
    });
  }

  // Nothing matched: show the most recent allowed messages so the brief is never empty.
  if (matched.length === 0) {
    const recent = [...readableSlack].sort((a, b) => b.date.localeCompare(a.date)).slice(0, FALLBACK_ITEMS);
    for (const m of recent) {
      items.push({
        id: `${decision.id}-${m.id}`,
        decisionId: decision.id,
        origin: 'slack',
        sourceLabel: channels.get(m.channelId)!.name,
        author: m.author,
        date: m.date,
        snippet: m.text,
        group: RECENT_GROUP,
        flaggedInaccurate: false,
        userEdited: false,
        removed: false,
      });
    }
  }

  // The PM's own framing notes and links.
  const today = decision.createdAt.slice(0, 10);
  if (decision.notes.trim()) {
    items.push({
      id: `${decision.id}-note`,
      decisionId: decision.id,
      origin: 'user-note',
      sourceLabel: 'Your framing notes',
      author: state.user?.name,
      date: today,
      snippet: decision.notes.trim(),
      group: USER_NOTES_GROUP,
      flaggedInaccurate: false,
      userEdited: false,
      removed: false,
    });
  }
  decision.links.forEach((link, i) => {
    if (!link.trim()) return;
    items.push({
      id: `${decision.id}-link-${i + 1}`,
      decisionId: decision.id,
      origin: 'user-note',
      sourceLabel: 'Link you added',
      author: state.user?.name,
      date: today,
      snippet: link.trim(),
      link: link.trim(),
      group: USER_NOTES_GROUP,
      flaggedInaccurate: false,
      userEdited: false,
      removed: false,
    });
  });

  // Last resort (nothing connected, no notes): say so as an item, never return empty.
  if (items.length === 0) {
    items.push({
      id: `${decision.id}-empty`,
      decisionId: decision.id,
      origin: 'user-note',
      sourceLabel: 'Rooted',
      date: today,
      snippet: 'No connected source had anything readable for this decision. Add your own context below.',
      group: USER_NOTES_GROUP,
      flaggedInaccurate: false,
      userEdited: false,
      removed: false,
    });
  }

  const matchedTheme = topTheme(matched);
  const themes = [
    ...(matchedTheme ? [matchedTheme] : []),
    ...themesForQuery(query).filter((t) => t !== matchedTheme),
  ];
  return { items, gaps: buildGaps(decision, state, themes) };
}

export function gatherBrief(decision: Decision, state: AppState): Promise<{ items: ContextItem[]; gaps: Gap[] }> {
  return think(buildBrief(decision, state));
}

// The narration shown while gathering: one line per source actually read.
export function gatherSteps(state: AppState): string[] {
  const steps: string[] = [];
  for (const source of state.sources) {
    for (const c of allowedChannels(source)) {
      steps.push(source.type === 'google-drive' ? `Reading Drive folder ${c.name}…` : `Reading ${c.name}…`);
    }
  }
  steps.push('Checking past decisions…');
  steps.push('Grouping by theme…');
  return steps;
}
