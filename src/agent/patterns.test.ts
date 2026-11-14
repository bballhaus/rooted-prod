import { describe, expect, it } from 'vitest';
import { demoState } from '../data/demoFixtures';
import { decisionStats, patternDecisions } from '../store/patterns';
import { fakeAi } from '../test/fakeAi';
import { findPatterns } from './patterns';

const TODAY = '2026-11-13';

describe('findPatterns (F-R3-05)', () => {
  const state = demoState(TODAY);
  const decisions = patternDecisions(state);
  const stats = decisionStats(state, decisions, TODAY);

  it('F-R3-05: sends each real decision with its choice, what was passed on and how it turned out', async () => {
    const ai = fakeAi();
    await findPatterns(ai, state, decisions, stats, TODAY);
    const [task, payload] = ai.run.mock.calls[0];
    expect(task).toBe('findPatterns');
    expect(payload.today).toBe(TODAY);
    expect(payload.decisions.map((d: { id: string }) => d.id)).not.toContain('d-future-usage-pricing');
    const seats = payload.decisions.find((d: { id: string }) => d.id === 'd-pricing-seats');
    expect(seats).toMatchObject({ goal: 'Expansion', status: 'outcome-logged', outcome: { result: 'worked' } });
    expect(seats.chosen).toBeTruthy();
    expect(payload.stats.perMonth).toHaveLength(6);
  });

  it('F-R3-05: what comes back is Rooted’s, not yet edited or dismissed, and cites the decisions it rests on', async () => {
    const out = await findPatterns(fakeAi(), state, decisions, stats, TODAY, new Date('2026-11-13T12:00:00Z'));
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ kind: 'pattern', userEdited: false, dismissed: false, foundAt: '2026-11-13T12:00:00.000Z' });
    expect(out[0].decisionIds.length).toBeGreaterThan(0);
    expect(out[1]).toMatchObject({ kind: 'prediction', watchFor: 'Accounts hitting the cap in the next month.' });
  });

  it('F-R3-05: with too little history it doesn’t call Claude at all', async () => {
    const ai = fakeAi();
    const few = decisions.filter((d) => d.status !== 'decided');
    await expect(findPatterns(ai, state, few, stats, TODAY)).rejects.toMatchObject({ code: 'nothing_to_read' });
    expect(ai.run).not.toHaveBeenCalled();
  });
});
