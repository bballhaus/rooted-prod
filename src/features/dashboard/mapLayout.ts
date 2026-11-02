// Lays decisions out for the map: time runs left to right, swimlanes run top to
// bottom (by thread, tag, owner, team or status), and decisions that would
// overlap in a lane drop to a new row in that lane. Pure, so it's tested
// without a browser.
import { decisionDate, MAP_STATUS_LABEL, mapStatus, ownerOf, visibleLinks } from '../../store/dashboard';
import type { AppState, Decision } from '../../types';

export type LaneBy = 'thread' | 'tag' | 'owner' | 'team' | 'status' | 'none';

export const LANE_LABEL: Record<LaneBy, string> = {
  thread: 'Thread',
  tag: 'Tag',
  owner: 'Who decided',
  team: 'Team',
  status: 'Status',
  none: 'No lanes',
};

export const NODE_W = 260;
export const NODE_H = 112;
const GAP_X = 28;
const ROW_H = NODE_H + 24;
const LANE_PAD = 36;
const PX_PER_DAY = 10;
export const LANE_LABEL_W = 150;

export const STANDALONE = 'Not linked yet';

/**
 * Threads: decisions joined by confirmed links (the team's own, or Rooted's once
 * accepted) share a lane, so a chain of decisions reads left to right. Each
 * thread is named after its most-used tag.
 */
const threadCache = new WeakMap<AppState, Map<string, string>>();
export function threadOf(d: Decision, state: AppState): string {
  let map = threadCache.get(state);
  if (!map) {
    map = buildThreads(state);
    threadCache.set(state, map);
  }
  return map.get(d.id) ?? STANDALONE;
}

function buildThreads(state: AppState): Map<string, string> {
  const parent = new Map(state.decisions.map((d) => [d.id, d.id]));
  const find = (x: string): string => {
    while (parent.get(x) !== x) x = parent.get(x)!;
    return x;
  };
  for (const l of visibleLinks(state)) {
    if (l.status !== 'accepted') continue;
    parent.set(find(l.fromId), find(l.toId));
  }
  const groups = new Map<string, Decision[]>();
  for (const d of state.decisions) groups.set(find(d.id), [...(groups.get(find(d.id)) ?? []), d]);
  const out = new Map<string, string>();
  const used = new Map<string, number>();
  const ordered = [...groups.values()]
    .filter((g) => g.length > 1)
    .sort((a, b) => b.length - a.length);
  for (const group of ordered) {
    const counts = new Map<string, number>();
    for (const d of group) for (const t of d.tags ?? []) if (t.origin === 'user') counts.set(t.label, (counts.get(t.label) ?? 0) + 1);
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? 'linked';
    const n = (used.get(top) ?? 0) + 1;
    used.set(top, n);
    const label = n === 1 ? `#${top}` : `#${top} (${n})`;
    for (const d of group) out.set(d.id, label);
  }
  return out;
}

export function laneOf(d: Decision, by: LaneBy, state: AppState, today: string): string {
  switch (by) {
    case 'thread':
      return threadOf(d, state);
    case 'tag':
      return d.tags?.find((t) => t.origin === 'user')?.label ?? d.tags?.[0]?.label ?? 'untagged';
    case 'owner':
      return ownerOf(d, state)?.name ?? 'Unknown';
    case 'team':
      return ownerOf(d, state)?.team ?? 'Unknown';
    case 'status':
      return MAP_STATUS_LABEL[mapStatus(d, state, today)];
    case 'none':
      return 'All decisions';
  }
}

const dayMs = 86_400_000;
const toDay = (iso: string) => Math.floor(Date.parse(`${iso}T00:00:00Z`) / dayMs);

export interface PlacedDecision {
  decision: Decision;
  x: number;
  y: number;
  lane: string;
}

export interface Lane {
  key: string;
  y: number;
  height: number;
}

export interface MonthTick {
  label: string;
  x: number;
}

export interface MapLayout {
  placed: PlacedDecision[];
  lanes: Lane[];
  months: MonthTick[];
  width: number;
  height: number;
}

export function layoutMap(decisions: Decision[], by: LaneBy, state: AppState, today: string): MapLayout {
  if (decisions.length === 0) return { placed: [], lanes: [], months: [], width: 0, height: 0 };
  const dates = decisions.map(decisionDate);
  const minDay = Math.min(...dates.map(toDay));
  const maxDay = Math.max(...dates.map(toDay));
  const xOf = (iso: string) => LANE_LABEL_W + (toDay(iso) - minDay) * PX_PER_DAY;

  // Lanes in order of their earliest decision, so the oldest threads sit on top;
  // decisions that aren't linked to anything go last.
  const unordered = new Map<string, Decision[]>();
  for (const d of [...decisions].sort((a, b) => decisionDate(a).localeCompare(decisionDate(b)))) {
    const key = laneOf(d, by, state, today);
    unordered.set(key, [...(unordered.get(key) ?? []), d]);
  }
  const groups = new Map(
    [...unordered].sort(([a], [b]) => Number(a === STANDALONE) - Number(b === STANDALONE)),
  );

  const placed: PlacedDecision[] = [];
  const lanes: Lane[] = [];
  let top = 0;
  for (const [key, items] of groups) {
    // Each row remembers where its last node ends; a node goes in the first row it fits.
    const rowEnds: number[] = [];
    const rows: number[] = [];
    for (const d of items) {
      const x = xOf(decisionDate(d));
      let row = rowEnds.findIndex((end) => x >= end + GAP_X);
      if (row === -1) {
        row = rowEnds.length;
        rowEnds.push(0);
      }
      rowEnds[row] = x + NODE_W;
      rows.push(row);
      placed.push({ decision: d, x, y: top + LANE_PAD + row * ROW_H, lane: key });
    }
    const height = LANE_PAD * 2 + Math.max(1, rowEnds.length) * ROW_H - (ROW_H - NODE_H);
    lanes.push({ key, y: top, height });
    top += height;
  }

  const months: MonthTick[] = [];
  const start = new Date(minDay * dayMs);
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  while (Math.floor(cursor.getTime() / dayMs) <= maxDay) {
    const iso = cursor.toISOString().slice(0, 10);
    months.push({
      label: cursor.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' }),
      x: Math.max(LANE_LABEL_W, xOf(iso)),
    });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  return {
    placed,
    lanes,
    months,
    width: xOf(new Date(maxDay * dayMs).toISOString().slice(0, 10)) + NODE_W,
    height: top,
  };
}
