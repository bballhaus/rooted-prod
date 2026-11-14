// Pure selectors for the home map, the "Needs you" rail and the inbox.
// Shared by the UI and the scripted agent; dates are local YYYY-MM-DD strings.
import { formatDate } from '../features/log/format';
import type { AppState, Decision, DecisionLink, Teammate } from '../types';

export function localToday(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return localToday(d);
}

export type MapStatus = 'open' | 'decided' | 'outcome-due' | 'outcome-logged';

export const MAP_STATUS_LABEL: Record<MapStatus, string> = {
  open: 'In progress',
  decided: 'Decided',
  'outcome-due': 'Outcome due',
  'outcome-logged': 'Outcome logged',
};

export function mapStatus(d: Decision, state: Pick<AppState, 'outcomes'>, today: string): MapStatus {
  if (d.status !== 'decided') return 'open';
  if (state.outcomes.some((o) => o.decisionId === d.id)) return 'outcome-logged';
  if (d.reviewDate && d.reviewDate <= today) return 'outcome-due';
  return 'decided';
}

/** Decisions without an owner predate teammates; they belong to the signed-in PM. */
export function ownerOf(d: Decision, state: Pick<AppState, 'user' | 'teammates'>): Teammate | undefined {
  const id = d.ownerId ?? state.user?.id;
  return state.teammates.find((t) => t.id === id);
}

export function isMine(d: Decision, state: Pick<AppState, 'user'>): boolean {
  return !d.ownerId || d.ownerId === state.user?.id;
}

/** The PM's local calendar day a decision sits at on the time axis: when it was logged, or started. */
export function decisionDate(d: Decision): string {
  return localToday(new Date(d.loggedAt ?? d.createdAt));
}

/** A decision's goal: its goal label, else its first tag. */
export function goalOf(d: Decision): string | undefined {
  return d.metric ?? d.tags?.[0]?.label;
}

export function chosenLabel(d: Decision, state: Pick<AppState, 'options'>): string | undefined {
  return state.options.find((o) => o.id === d.chosenOptionId)?.label;
}

/** Links the map draws: everything except dismissed ones, between decisions that still exist. */
export function visibleLinks(state: Pick<AppState, 'links' | 'decisions'>): DecisionLink[] {
  const ids = new Set(state.decisions.map((d) => d.id));
  return state.links.filter((l) => l.status !== 'dismissed' && ids.has(l.fromId) && ids.has(l.toId));
}

export function linksOf(decisionId: string, state: Pick<AppState, 'links' | 'decisions'>) {
  const links = visibleLinks(state);
  return {
    buildsOn: links.filter((l) => l.toId === decisionId),
    ledTo: links.filter((l) => l.fromId === decisionId),
  };
}

export type InboxKind = 'outcome-due' | 'deadline' | 'suggestion' | 'link' | 'gap';

export interface InboxItem {
  id: string;
  kind: InboxKind;
  title: string;
  detail: string;
  date: string;
  due: boolean; // counts toward the red badge
  decisionId?: string;
  suggestionId?: string;
  linkId?: string;
}

const DEADLINE_WINDOW_DAYS = 3;

/**
 * Everything that needs the PM: outcomes due on their decisions, deadlines
 * coming up, decisions the agent spotted, links the agent wants confirmed and
 * gaps it couldn't fill. Due items come first, then newest.
 */
export function inboxItems(state: AppState, today: string): InboxItem[] {
  const items: InboxItem[] = [];
  const byId = new Map(state.decisions.map((d) => [d.id, d]));
  const soon = addDaysIso(today, DEADLINE_WINDOW_DAYS);

  for (const d of state.decisions) {
    if (!isMine(d, state)) continue;
    if (mapStatus(d, state, today) === 'outcome-due') {
      items.push({
        id: `inbox-outcome-${d.id}`,
        kind: 'outcome-due',
        title: d.question,
        detail:
          d.reviewDate && d.reviewDate < today ? `Outcome overdue since ${formatDate(d.reviewDate)}` : 'Outcome due today',
        date: d.reviewDate ?? today,
        due: true,
        decisionId: d.id,
      });
    }
    if (d.status !== 'decided' && d.deadline && d.deadline <= soon) {
      items.push({
        id: `inbox-deadline-${d.id}`,
        kind: 'deadline',
        title: d.question,
        detail: d.deadline < today ? `Deadline passed on ${formatDate(d.deadline)}` : `Deadline ${formatDate(d.deadline)}`,
        date: d.deadline,
        due: true,
        decisionId: d.id,
      });
    }
  }

  for (const s of state.suggestions) {
    if (s.status !== 'new') continue;
    items.push({
      id: `inbox-suggestion-${s.id}`,
      kind: 'suggestion',
      title: s.question,
      detail: s.why,
      date: s.suggestedAt.slice(0, 10),
      due: false,
      suggestionId: s.id,
    });
  }

  for (const l of visibleLinks(state)) {
    if (l.origin !== 'ai' || l.status !== 'suggested') continue;
    const from = byId.get(l.fromId);
    const to = byId.get(l.toId);
    if (!from || !to) continue;
    items.push({
      id: `inbox-link-${l.id}`,
      kind: 'link',
      title: `Connect “${from.question}” to “${to.question}”?`,
      detail: l.reason ?? 'Rooted thinks these decisions are related.',
      date: decisionDate(to),
      due: false,
      linkId: l.id,
      decisionId: to.id,
    });
  }

  for (const g of state.gaps) {
    const d = byId.get(g.decisionId);
    if (!d || g.answer || d.status === 'decided' || !isMine(d, state)) continue;
    items.push({
      id: `inbox-gap-${g.id}`,
      kind: 'gap',
      title: g.question,
      detail: `Missing for “${d.question}”`,
      date: d.createdAt.slice(0, 10),
      due: false,
      decisionId: d.id,
    });
  }

  return items.sort((a, b) => Number(b.due) - Number(a.due) || b.date.localeCompare(a.date));
}

/** Every tag used in the workspace, most used first. */
export function workspaceTags(state: Pick<AppState, 'decisions'>): string[] {
  const counts = new Map<string, number>();
  for (const d of state.decisions) for (const t of d.tags ?? []) counts.set(t.label, (counts.get(t.label) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([t]) => t);
}
