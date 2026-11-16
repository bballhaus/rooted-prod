import { describe, expect, it } from 'vitest';
import { lineage, treeLayout } from './graphLayout';

const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
const edges = [
  { from: 'a', to: 'b' },
  { from: 'b', to: 'c' },
  { from: 'a', to: 'd' },
  { from: 'e', to: 'f' },
];
const sizes = { nodeW: 260, nodeH: 112 };

describe('tree layout', () => {
  const tree = treeLayout(ids, edges, sizes);
  const at = (id: string) => tree.pos.get(id)!;

  it('F-17: lays the same decisions out the same way every time', () => {
    expect([...treeLayout(ids, edges, sizes).pos]).toEqual([...tree.pos]);
  });

  it('F-17: reads left to right: each decision sits right of what it builds on', () => {
    expect(at('b').x).toBeGreaterThan(at('a').x);
    expect(at('c').x).toBeGreaterThan(at('b').x);
    expect(at('d').x).toBe(at('b').x);
    expect(at('f').x).toBeGreaterThan(at('e').x);
  });

  it('F-17: a decision with one parent and no siblings sits level with it', () => {
    expect(at('c').y).toBe(at('b').y);
    expect(at('f').y).toBe(at('e').y);
  });

  it('F-17: separate trees stack, biggest first, and unlinked decisions come last', () => {
    expect(tree.groups.map((g) => [g.ids, g.loose])).toEqual([
      [['a', 'b', 'c', 'd'], false],
      [['e', 'f'], false],
      [['g'], true],
    ]);
    expect(at('e').y).toBeGreaterThan(Math.max(at('b').y, at('d').y));
    expect(at('g').y).toBeGreaterThan(at('e').y);
  });

  it('F-17: no two cards overlap', () => {
    const pts = [...tree.pos.values()];
    for (let i = 0; i < pts.length; i++)
      for (let j = i + 1; j < pts.length; j++) {
        const apart = Math.abs(pts[i].x - pts[j].x) >= sizes.nodeW || Math.abs(pts[i].y - pts[j].y) >= sizes.nodeH;
        expect(apart).toBe(true);
      }
  });

  it('places a decision for every id, ignores links to decisions not shown, and survives a cycle', () => {
    expect(tree.pos.size).toBe(ids.length);
    expect(treeLayout([], [], sizes).pos.size).toBe(0);
    const odd = treeLayout(['a', 'b'], [{ from: 'a', to: 'zz' }, { from: 'a', to: 'b' }, { from: 'b', to: 'a' }], sizes);
    expect(odd.pos.size).toBe(2);
  });
});

describe('lineage', () => {
  it('F-19: is everything a decision built on and everything it led to, and nothing unrelated', () => {
    expect(lineage(edges, 'b')).toEqual(new Set(['a', 'b', 'c']));
    expect(lineage(edges, 'a')).toEqual(new Set(['a', 'b', 'c', 'd']));
    expect(lineage(edges, 'f')).toEqual(new Set(['e', 'f']));
  });

  it('survives a cycle', () => {
    expect(lineage([...edges, { from: 'c', to: 'a' }], 'b')).toEqual(new Set(['a', 'b', 'c', 'd']));
  });
});
