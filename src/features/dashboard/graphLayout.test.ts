import { describe, expect, it } from 'vitest';
import { graphLayout, lineage } from './graphLayout';

const ids = ['a', 'b', 'c', 'd', 'e', 'f'];
const edges = [
  { from: 'a', to: 'b' },
  { from: 'b', to: 'c' },
  { from: 'a', to: 'd' },
  { from: 'e', to: 'f' },
];

describe('graph layout', () => {
  it('F-17: lays the same decisions out the same way every time', () => {
    expect([...graphLayout(ids, edges)]).toEqual([...graphLayout(ids, edges)]);
  });

  it('F-17: keeps every pair of decisions at least the minimum gap apart', () => {
    const pos = [...graphLayout(ids, edges, 300).values()];
    for (let i = 0; i < pos.length; i++)
      for (let j = i + 1; j < pos.length; j++) {
        expect(Math.hypot(pos[i].x - pos[j].x, pos[i].y - pos[j].y)).toBeGreaterThanOrEqual(299.9);
      }
  });

  it('places a decision for every id, and nothing for none', () => {
    expect(graphLayout(ids, edges).size).toBe(ids.length);
    expect(graphLayout([], []).size).toBe(0);
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
