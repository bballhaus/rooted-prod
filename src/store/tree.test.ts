import { seedState } from '../data/fixtures';
import type { OptionNode } from '../types';
import { reducer } from './store';
import { ancestorIds, descendantIds, pathLabel, splitForLog, underPruned } from './tree';

function node(id: string, parentId: string | null, patch: Partial<OptionNode> = {}): OptionNode {
  return {
    id,
    decisionId: 'd-x',
    parentId,
    label: id.toUpperCase(),
    summary: '',
    pros: [],
    cons: [],
    score: 50,
    contextIds: [],
    state: 'open',
    ...patch,
  };
}

// A ─┬─ A1 ─── A1a
//    └─ A2
// B ─── B1
const tree = [node('a', null), node('a1', 'a'), node('a1a', 'a1'), node('a2', 'a'), node('b', null), node('b1', 'b')];

describe('option tree', () => {
  it('F-10: walks up and down the tree', () => {
    expect(ancestorIds(tree, 'a1a')).toEqual(['a', 'a1']);
    expect([...descendantIds(tree, 'a')].sort()).toEqual(['a1', 'a1a', 'a2']);
    expect(pathLabel(tree, 'a1a')).toBe('A › A1 › A1A');
  });

  it('F-10: an option under a pruned branch is marked as such', () => {
    const pruned = tree.map((o) => (o.id === 'a' ? { ...o, state: 'pruned' as const } : o));
    expect(underPruned(pruned, 'a1a')).toBe(true);
    expect(underPruned(pruned, 'b1')).toBe(false);
  });

  it('F-14: choosing a sub-option keeps its path and asks for reasons only for the alternatives', () => {
    const { keep, alternatives, notTaken } = splitForLog(tree, 'a1');
    expect([...keep].sort()).toEqual(['a', 'a1', 'a1a']);
    expect(alternatives.map((o) => o.id).sort()).toEqual(['a2', 'b']);
    expect(notTaken.map((o) => o.id).sort()).toEqual(['a2', 'b', 'b1']);
  });

  it('F-18: logging a sub-option prunes the alternatives with reasons and keeps the branch above it', () => {
    const s0 = { ...seedState(), options: tree };
    const s1 = reducer(s0, {
      type: 'logDecision',
      decisionId: 'd-x',
      chosenOptionId: 'a1',
      summary: 's',
      rationale: 'r',
      pruned: [
        { optionId: 'a2', reason: 'Too slow' },
        { optionId: 'b', reason: 'Too costly' },
      ],
      loggedAt: '2026-10-28T00:00:00.000Z',
    });
    const get = (id: string) => s1.options.find((o) => o.id === id)!;
    expect(get('a1').state).toBe('chosen');
    expect(get('a').state).toBe('open');
    expect(get('a1a').state).toBe('open');
    expect(get('a2')).toMatchObject({ state: 'pruned', pruneReason: 'Too slow' });
    expect(get('b')).toMatchObject({ state: 'pruned', pruneReason: 'Too costly' });
    expect(get('b1')).toMatchObject({ state: 'pruned', pruneReason: 'Under a branch not taken: “B”' });
  });
});
