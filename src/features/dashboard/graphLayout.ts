// Graph layout and lineage for the decision map's Graph view (decision 0010).
// Pure and deterministic (no Math.random, no Date) so the same decisions
// always lay out the same way. Coordinates are node centres.

export interface GraphEdge {
  from: string;
  to: string;
}

export interface Pt {
  x: number;
  y: number;
}

// Closest two node centres may sit; a little more than a card's width.
const MIN_GAP = 340;

/**
 * Organic graph layout: a small deterministic force simulation (repulsion +
 * edge springs + gentle gravity), seeded from a phyllotaxis spiral so it never
 * depends on randomness.
 */
export function graphLayout(ids: string[], edges: GraphEdge[], minGap = MIN_GAP): Map<string, Pt> {
  const n = ids.length;
  if (n === 0) return new Map();
  const idx = new Map(ids.map((id, i) => [id, i]));
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
  const target = minGap;
  if (Number.isFinite(minD) && minD > 0 && minD < target) {
    const s = Math.min(4, target / minD);
    for (let i = 0; i < n; i++) {
      x[i] *= s;
      y[i] *= s;
    }
  }

  const pos = new Map<string, Pt>();
  ids.forEach((id, i) => pos.set(id, { x: x[i], y: y[i] }));
  return pos;
}

/** Everything upstream and downstream of a decision, plus the decision: its lineage. */
export function lineage(edges: GraphEdge[], id: string): Set<string> {
  const parents = new Map<string, string[]>();
  const children = new Map<string, string[]>();
  for (const e of edges) {
    parents.set(e.to, [...(parents.get(e.to) ?? []), e.from]);
    children.set(e.from, [...(children.get(e.from) ?? []), e.to]);
  }
  const out = new Set<string>([id]);
  // Walk each direction with its own visited set, so a cycle can't cut one short.
  for (const next of [parents, children]) {
    const seen = new Set<string>([id]);
    const stack = [id];
    while (stack.length) {
      for (const other of next.get(stack.pop()!) ?? []) {
        if (seen.has(other)) continue;
        seen.add(other);
        out.add(other);
        stack.push(other);
      }
    }
  }
  return out;
}
