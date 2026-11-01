// Layout math for the decision map. Pure and deterministic (no Math.random, no
// Date) so the same decisions always lay out the same way. Coordinates are node
// centres in an abstract space; the canvas fits them to the viewport.
import type { DecisionStatus } from '../../types';

export interface MapNode {
  id: string;
  question: string;
  kind: 'decided' | 'open' | 'future';
  status: DecisionStatus;
  metric?: string;
  owner: string;
  chosen?: string;
  builtOn: string[];
  external?: boolean; // belongs to another person (org view): read-only
}

export interface MapEdge {
  from: string;
  to: string;
}

export interface Pt {
  x: number;
  y: number;
}

export function buildEdges(nodes: MapNode[]): MapEdge[] {
  const ids = new Set(nodes.map((n) => n.id));
  const edges: MapEdge[] = [];
  for (const n of nodes) for (const p of n.builtOn) if (ids.has(p)) edges.push({ from: p, to: n.id });
  return edges;
}

// Longest-path depth from a root, memoised with a cycle guard.
function depths(nodes: MapNode[]): Map<string, number> {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const depth = new Map<string, number>();
  const busy = new Set<string>();
  function d(id: string): number {
    if (depth.has(id)) return depth.get(id)!;
    if (busy.has(id)) return 0;
    busy.add(id);
    const parents = (byId.get(id)?.builtOn ?? []).filter((p) => byId.has(p));
    const v = parents.length ? Math.max(...parents.map(d)) + 1 : 0;
    busy.delete(id);
    depth.set(id, v);
    return v;
  }
  nodes.forEach((n) => d(n.id));
  return depth;
}

const COL = 250;
const ROW = 128;

/** Chronological layered layout: roots left, what they led to spreading right. */
export function timelineLayout(nodes: MapNode[]): Map<string, Pt> {
  const depth = depths(nodes);
  const maxCol = Math.max(0, ...nodes.map((n) => depth.get(n.id)!));
  const cols: MapNode[][] = Array.from({ length: maxCol + 1 }, () => []);
  nodes.forEach((n) => cols[depth.get(n.id)!].push(n));
  cols.forEach((c) => c.sort((a, b) => a.id.localeCompare(b.id)));
  const maxRows = Math.max(1, ...cols.map((c) => c.length));
  const pos = new Map<string, Pt>();
  cols.forEach((col, ci) => {
    const top = ((maxRows - col.length) * ROW) / 2;
    col.forEach((n, ri) => pos.set(n.id, { x: ci * COL, y: top + ri * ROW }));
  });
  return pos;
}

/**
 * Organic graph layout: a small deterministic force simulation (repulsion +
 * edge springs + gentle gravity), seeded from a phyllotaxis spiral so it never
 * depends on randomness.
 */
export function graphLayout(nodes: MapNode[], edges: MapEdge[]): Map<string, Pt> {
  const n = nodes.length;
  if (n === 0) return new Map();
  const idx = new Map(nodes.map((nd, i) => [nd.id, i]));
  const x = new Float64Array(n);
  const y = new Float64Array(n);
  const step = 96;
  for (let i = 0; i < n; i++) {
    const r = step * Math.sqrt(i + 0.6);
    const a = i * 2.399963229728653; // golden angle
    x[i] = r * Math.cos(a);
    y[i] = r * Math.sin(a);
  }
  const E = edges
    .map((e) => [idx.get(e.from)!, idx.get(e.to)!] as const)
    .filter(([a, b]) => a !== undefined && b !== undefined);

  const REP = 26000;
  const SPRING = 0.035;
  const LEN = 240;
  const GRAV = 0.012;
  for (let it = 0; it < 240; it++) {
    const dx = new Float64Array(n);
    const dy = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        let ox = x[i] - x[j];
        let oy = y[i] - y[j];
        let d2 = ox * ox + oy * oy;
        if (d2 < 0.01) {
          ox = (i - j) || 1;
          oy = 1;
          d2 = ox * ox + oy * oy;
        }
        const f = REP / d2;
        const d = Math.sqrt(d2);
        const fx = (ox / d) * f;
        const fy = (oy / d) * f;
        dx[i] += fx;
        dy[i] += fy;
        dx[j] -= fx;
        dy[j] -= fy;
      }
    }
    for (const [a, b] of E) {
      const ox = x[b] - x[a];
      const oy = y[b] - y[a];
      const d = Math.sqrt(ox * ox + oy * oy) || 1;
      const f = (d - LEN) * SPRING;
      const fx = (ox / d) * f;
      const fy = (oy / d) * f;
      dx[a] += fx;
      dy[a] += fy;
      dx[b] -= fx;
      dy[b] -= fy;
    }
    for (let i = 0; i < n; i++) {
      dx[i] -= x[i] * GRAV;
      dy[i] -= y[i] * GRAV;
      const cap = 40;
      x[i] += Math.max(-cap, Math.min(cap, dx[i]));
      y[i] += Math.max(-cap, Math.min(cap, dy[i]));
    }
  }
  // Normalise spacing so nodes never overlap, whatever the node count: scale up
  // until the closest pair is at least a node-width-and-a-bit apart.
  let minD = Infinity;
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++) {
      const d = Math.hypot(x[i] - x[j], y[i] - y[j]);
      if (d < minD) minD = d;
    }
  const target = 236;
  if (Number.isFinite(minD) && minD > 0 && minD < target) {
    const s = Math.min(4, target / minD);
    for (let i = 0; i < n; i++) {
      x[i] *= s;
      y[i] *= s;
    }
  }

  const pos = new Map<string, Pt>();
  nodes.forEach((nd, i) => pos.set(nd.id, { x: x[i], y: y[i] }));
  return pos;
}

/** Everything upstream and downstream of a node, plus the node — its lineage. */
export function lineage(nodes: MapNode[], id: string): Set<string> {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const childrenOf = new Map<string, string[]>();
  for (const n of nodes) for (const p of n.builtOn) {
    if (!childrenOf.has(p)) childrenOf.set(p, []);
    childrenOf.get(p)!.push(n.id);
  }
  const out = new Set<string>([id]);
  const up = [id];
  while (up.length) {
    const cur = up.pop()!;
    for (const p of byId.get(cur)?.builtOn ?? []) if (byId.has(p) && !out.has(p)) {
      out.add(p);
      up.push(p);
    }
  }
  const down = [id];
  while (down.length) {
    const cur = down.pop()!;
    for (const c of childrenOf.get(cur) ?? []) if (!out.has(c)) {
      out.add(c);
      down.push(c);
    }
  }
  return out;
}

// Brand-adjacent categorical palette for colour-coding by metric or owner. The
// earthy family keeps it on-brand; status colouring uses the semantic tokens.
export const CATEGORY_COLORS = ['#581c32', '#8e4056', '#7d8a68', '#c39aa3', '#5f6b4f', '#6e4a59', '#9a6b4a', '#4a5a63'];

export function categoryColor(value: string, values: string[]): string {
  const i = Math.max(0, values.indexOf(value));
  return CATEGORY_COLORS[i % CATEGORY_COLORS.length];
}
