// F-06, F-07, F-09: the evidence brief. Claude picks what bears on the decision
// from the messages it may read and says what's missing (gaps). A connected
// Slack workspace is read on the server (0017); the demo's sample Slack and
// Drive are sent from here. Only allowed channels and folders are ever read.
import { slackCorpus, driveCorpus } from '../data/slackCorpus';
import { chosenLabel, decisionDate } from '../store/dashboard';
import type { AppState, Channel, ContextItem, ContextOrigin, Decision, Gap, Source } from '../types';
import { fit, framingOf, LIMITS, type AiClient } from './client';

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
      excluded.push({ label: source.name, reason: source.unavailable ? 'not available yet' : 'not connected' });
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

// The narration shown while gathering: one line per source actually read.
export function gatherSteps(state: AppState): string[] {
  const steps: string[] = [];
  for (const source of state.sources) {
    for (const c of allowedChannels(source)) {
      steps.push(source.type === 'google-drive' ? `Reading Drive folder ${c.name}…` : `Reading ${c.name}…`);
    }
  }
  steps.push('Checking past decisions…');
  steps.push('Picking what matters and what’s missing…');
  return steps;
}

export interface BriefMessage {
  ref: string;
  source: string;
  author?: string;
  date: string;
  text: string;
}

/** The demo's sample Slack and Drive content from allowed channels and folders. */
export function sampleMessages(state: AppState): BriefMessage[] {
  const out: BriefMessage[] = [];
  for (const source of state.sources.filter((s) => s.sample)) {
    const allowed = new Map(allowedChannels(source).map((c) => [c.id, c.name]));
    if (source.type === 'slack') {
      for (const m of slackCorpus) {
        if (allowed.has(m.channelId)) out.push({ ref: `slack:${m.id}`, source: allowed.get(m.channelId)!, author: m.author, date: m.date, text: fit(m.text, LIMITS.context) });
      }
    } else {
      for (const d of driveCorpus) {
        if (allowed.has(d.folderId)) out.push({ ref: `drive:${d.id}`, source: `Drive: ${d.title}`, author: d.author, date: d.date, text: fit(d.text, LIMITS.context) });
      }
    }
  }
  return out;
}

/** Where this workspace's messages come from: a live Slack connection, or sample content. */
export function briefSource(state: AppState): { kind: 'slack'; channelIds: string[] } | { kind: 'sample' } {
  const live = state.sources.find((s) => s.type === 'slack' && !s.sample);
  if (live?.connected) return { kind: 'slack', channelIds: allowedChannels(live).map((c) => c.id) };
  return { kind: 'sample' };
}

/** What Claude is told about one decision. */
export function decisionSummary(d: Decision, state: AppState) {
  return {
    id: d.id,
    question: fit(d.question, LIMITS.question),
    date: decisionDate(d),
    chosen: chosenLabel(d, state) ?? null,
    rationale: d.rationale ? fit(d.rationale, LIMITS.context) : null,
    tags: (d.tags ?? []).map((t) => t.label),
  };
}

export function pastDecisionsFor(state: AppState, exclude?: string) {
  return state.decisions.filter((d) => d.status === 'decided' && d.id !== exclude).map((d) => decisionSummary(d, state));
}

interface BriefItem {
  kind: 'message' | 'past-decision';
  ref: string;
  group: string;
  source: string;
  author?: string | null;
  date: string;
  text: string;
  link?: string | null;
}

function originOf(item: BriefItem): ContextOrigin {
  if (item.kind === 'past-decision') return 'past-decision';
  return item.ref.startsWith('drive:') ? 'drive' : 'slack';
}

export async function gatherBrief(ai: AiClient, decision: Decision, state: AppState): Promise<{ items: ContextItem[]; gaps: Gap[] }> {
  const source = briefSource(state);
  const result = await ai.run<{ items: BriefItem[]; gaps: string[] }>('brief', {
    decision: framingOf(decision),
    pastDecisions: pastDecisionsFor(state, decision.id),
    source,
    messages: source.kind === 'sample' ? sampleMessages(state) : [],
  });
  const items: ContextItem[] = result.items.map((item) => ({
    id: `${decision.id}-${item.ref}`,
    decisionId: decision.id,
    origin: originOf(item),
    sourceLabel: item.source,
    author: item.author ?? undefined,
    date: item.date,
    snippet: item.text,
    link: item.link ?? undefined,
    group: item.group,
    flaggedInaccurate: false,
    userEdited: false,
    removed: false,
  }));
  // The PM's own framing notes are context too; they're theirs, not Claude's pick.
  if (decision.notes.trim()) {
    items.push({
      id: `${decision.id}-notes`,
      decisionId: decision.id,
      origin: 'user-note',
      sourceLabel: 'Your framing notes',
      date: decision.createdAt.slice(0, 10),
      snippet: decision.notes.trim(),
      group: 'Your notes',
      flaggedInaccurate: false,
      userEdited: false,
      removed: false,
    });
  }
  const gaps: Gap[] = result.gaps.map((question, i) => ({ id: `${decision.id}-gap-${i + 1}`, decisionId: decision.id, question }));
  return { items, gaps };
}
