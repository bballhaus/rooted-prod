// Tree layout and lineage for the decision map's Tree view (decisions 0010,
// 0019). Pure and deterministic (no Math.random, no Date) so the same decisions
// always lay out the same way. Coordinates are each card's top-left corner.

export interface GraphEdge {
  from: string;
  to: string;
}

export interface Pt {
  x: number;
  y: number;
}

/** One tree of linked decisions, or the decisions not linked to anything. */
export interface TreeGroup {
  ids: string[]; // in the order they were given
  x: number;
  y: number; // top of the group's first row of cards
  loose: boolean; // the decisions with no links, set out in a grid
}

export interface TreeLayout {
  pos: Map<string, Pt>;
  groups: TreeGroup[];
  width: number;
  height: number;
}

export interface TreeSizes {
  nodeW: number;
  nodeH: number;
  colGap?: number; // between generations, room for the branch lines
  rowGap?: number; // between cards in one generation
  groupGap?: number; // between trees, room for each tree's label
  looseCols?: number; // cards per row for decisions with no links
}

/**
 * A layered tree, read left to right: each decision sits one column to the
 * right of the latest decision it builds on, and is pulled level with the
 * decisions it came from, so a chain of decisions reads as a branch. Separate
 * trees stack top to bottom, biggest first; decisions with no links sit last,
 * in a grid. `ids` should be oldest first, which breaks every tie.
 */
export function treeLayout(ids: string[], edges: GraphEdge[], sizes: TreeSizes): TreeLayout {
  const { nodeW, nodeH, colGap = 120, rowGap = 28, groupGap = 88, looseCols = 4 } = sizes;
  const COL = nodeW + colGap;
  const ROW = nodeH + rowGap;
  const known = new Set(ids);
  const order = new Map(ids.map((id, i) => [id, i]));
  const parents = new Map<string, string[]>(ids.map((id) => [id, []]));
  const children = new Map<string, string[]>(ids.map((id) => [id, []]));
  const seenPair = new Set<string>();
  for (const e of edges) {
    if (!known.has(e.from) || !known.has(e.to) || e.from === e.to || seenPair.has(`${e.from}>${e.to}`)) continue;
    seenPair.add(`${e.from}>${e.to}`);
    parents.get(e.to)!.push(e.from);
    children.get(e.from)!.push(e.to);
  }
  const byAge = (a: string, b: string) => order.get(a)! - order.get(b)!;

  // Trees: decisions joined by any link, in either direction.
  const root = new Map(ids.map((id) => [id, id]));
  const find = (x: string): string => {
    while (root.get(x) !== x) x = root.get(x)!;
    return x;
  };
  for (const [to, from] of parents) for (const f of from) root.set(find(f), find(to));
  const comps = new Map<string, string[]>();
  for (const id of ids) comps.set(find(id), [...(comps.get(find(id)) ?? []), id]);
  const trees = [...comps.values()].filter((c) => c.length > 1).sort((a, b) => b.length - a.length || byAge(a[0], b[0]));
  const loose = [...comps.values()].filter((c) => c.length === 1).map((c) => c[0]);

  const pos = new Map<string, Pt>();
  const groups: TreeGroup[] = [];
  let top = 0;
  let width = 0;

  for (const tree of trees) {
    // Generation: one more than the latest decision it builds on. A cycle
    // can't loop forever; whatever is left over joins after its known parents.
    const rank = new Map<string, number>();
    const pending = new Map(tree.map((id) => [id, parents.get(id)!.length]));
    let ready = tree.filter((id) => pending.get(id) === 0);
    while (ready.length) {
      const next: string[] = [];
      for (const id of ready) {
        rank.set(id, Math.max(0, ...parents.get(id)!.map((p) => (rank.get(p) ?? -1) + 1)));
        for (const c of children.get(id)!) {
          pending.set(c, pending.get(c)! - 1);
          if (pending.get(c) === 0) next.push(c);
        }
      }
      ready = next;
    }
    for (const id of tree) if (!rank.has(id)) rank.set(id, Math.max(0, ...parents.get(id)!.map((p) => (rank.get(p) ?? -1) + 1)));

    const depth = Math.max(...tree.map((id) => rank.get(id)!));
    const cols: string[][] = Array.from({ length: depth + 1 }, () => []);
    for (const id of tree) cols[rank.get(id)!].push(id);
    for (const col of cols) col.sort(byAge);

    // Untangle: sort each column by where its parents sit, then by its children.
    const index = new Map<string, number>();
    const reindex = () => cols.forEach((col) => col.forEach((id, i) => index.set(id, i)));
    reindex();
    const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
    for (let pass = 0; pass < 3; pass++) {
      for (let r = 1; r <= depth; r++) {
        const key = new Map(cols[r].map((id) => [id, parents.get(id)!.length ? mean(parents.get(id)!.map((p) => index.get(p)!)) : index.get(id)!]));
        cols[r].sort((a, b) => key.get(a)! - key.get(b)! || byAge(a, b));
        reindex();
      }
      for (let r = depth - 1; r >= 0; r--) {
        const key = new Map(cols[r].map((id) => [id, children.get(id)!.length ? mean(children.get(id)!.map((c) => index.get(c)!)) : index.get(id)!]));
        cols[r].sort((a, b) => key.get(a)! - key.get(b)! || byAge(a, b));
        reindex();
      }
    }

    // Rows: each card is pulled level with what it's linked to, never closer
    // than a row to its neighbor in the same column.
    const y = new Map<string, number>();
    cols.forEach((col) => col.forEach((id, i) => y.set(id, i * ROW)));
    const settle = (col: string[], want: (id: string) => number | undefined) => {
      const desired = col.map((id) => want(id) ?? y.get(id)!);
      const placed: number[] = [];
      desired.forEach((d, i) => placed.push(i === 0 ? d : Math.max(d, placed[i - 1] + ROW)));
      // Spread any push-down evenly, so the column stays centred on its links.
      const drift = mean(placed.map((p, i) => p - desired[i]));
      col.forEach((id, i) => y.set(id, placed[i] - drift));
    };
    const fromParents = (id: string) => (parents.get(id)!.length ? mean(parents.get(id)!.map((p) => y.get(p)!)) : undefined);
    const fromChildren = (id: string) => (children.get(id)!.length ? mean(children.get(id)!.map((c) => y.get(c)!)) : undefined);
    for (let pass = 0; pass < 2; pass++) {
      for (let r = 1; r <= depth; r++) settle(cols[r], fromParents);
      for (let r = depth - 1; r >= 0; r--) settle(cols[r], fromChildren);
    }
    for (let r = 1; r <= depth; r++) settle(cols[r], fromParents);

    const minY = Math.min(...tree.map((id) => y.get(id)!));
    const maxY = Math.max(...tree.map((id) => y.get(id)!));
    for (const id of tree) pos.set(id, { x: rank.get(id)! * COL, y: top + y.get(id)! - minY });
    groups.push({ ids: [...tree].sort(byAge), x: 0, y: top, loose: false });
    width = Math.max(width, depth * COL + nodeW);
    top += maxY - minY + nodeH + groupGap;
  }

  if (loose.length) {
    // Newest first, so what was just added is easy to find.
    const sorted = [...loose].sort((a, b) => byAge(b, a));
    const perRow = Math.max(1, looseCols);
    sorted.forEach((id, i) => pos.set(id, { x: (i % perRow) * COL, y: top + Math.floor(i / perRow) * ROW }));
    groups.push({ ids: [...loose].sort(byAge), x: 0, y: top, loose: true });
    width = Math.max(width, (Math.min(perRow, sorted.length) - 1) * COL + nodeW);
    top += Math.ceil(sorted.length / perRow) * ROW - rowGap + groupGap;
  }

  return { pos, groups, width, height: Math.max(0, top - groupGap) };
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
