import { seedState } from '../data/fixtures';
import { reducer } from './store';

describe('store', () => {
  it('F-14: logDecision marks the chosen option and keeps rejected options with reasons', () => {
    const s0 = seedState();
    s0.options.push(
      { id: 'a', decisionId: 'd-x', parentId: null, label: 'A', summary: '', pros: [], cons: [], score: 60, contextIds: [], state: 'open' },
      { id: 'b', decisionId: 'd-x', parentId: null, label: 'B', summary: '', pros: [], cons: [], score: 40, contextIds: [], state: 'open' },
    );
    const s1 = reducer(s0, {
      type: 'logDecision',
      decisionId: 'd-x',
      chosenOptionId: 'a',
      summary: 's',
      rationale: 'r',
      pruned: [{ optionId: 'b', reason: 'too slow' }],
      loggedAt: '2026-10-28T00:00:00.000Z',
    });
    expect(s1.options.find((o) => o.id === 'a')?.state).toBe('chosen');
    const b = s1.options.find((o) => o.id === 'b');
    expect(b?.state).toBe('pruned');
    expect(b?.pruneReason).toBe('too slow');
  });

  it('F-23: deleteAllData clears decisions and disconnects sources', () => {
    const s1 = reducer(seedState(), { type: 'deleteAllData' });
    expect(s1.decisions).toHaveLength(0);
    expect(s1.sources.every((s) => !s.connected)).toBe(true);
  });
});
