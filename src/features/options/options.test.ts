import { describe, expect, it } from 'vitest';
import { citableContext, fetchOptions } from '../../agent/options';
import { seedState } from '../../data/fixtures';
import { fakeAi } from '../../test/fakeAi';
import type { AppState, ContextItem, Decision, OptionNode } from '../../types';

const decision: Decision = {
  id: 'd-trial',
  question: 'Should the trial use a usage limit or a 14-day time limit?',
  notes: 'Conversion slipped.',
  links: [],
  constraints: ['No new billing code'],
  status: 'brief',
  createdAt: '2026-10-20T17:00:00.000Z',
};

const item = (id: string, patch: Partial<ContextItem> = {}): ContextItem => ({
  id,
  decisionId: 'd-trial',
  origin: 'slack',
  sourceLabel: '#growth',
  date: '2026-10-14',
  snippet: `Evidence ${id}`,
  group: 'Usage',
  flaggedInaccurate: false,
  userEdited: false,
  removed: false,
  ...patch,
});

function state(patch: Partial<AppState> = {}): AppState {
  const base = seedState();
  return {
    ...base,
    decisions: [decision, ...base.decisions],
    contextItems: [item('c-1'), item('c-gone', { removed: true }), item('c-wrong', { flaggedInaccurate: true }), item('c-other', { decisionId: 'd-other' })],
    gaps: [{ id: 'g-1', decisionId: 'd-trial', question: 'What conversion target?', answer: '15%' }],
    ...patch,
  };
}

describe('options', () => {
  it('F-08: only this decision’s context that the PM hasn’t removed or marked wrong can be cited', () => {
    expect(citableContext('d-trial', state().contextItems).map((c) => c.id)).toEqual(['c-1']);
  });

  it('F-10: sends the framing, trusted evidence, the gaps and their answers, and past decisions', async () => {
    const ai = fakeAi();
    await fetchOptions(ai, decision, state());
    const [task, payload] = ai.run.mock.calls[0];
    expect(task).toBe('options');
    expect(payload.decision).toEqual({ question: decision.question, notes: 'Conversion slipped.', constraints: ['No new billing code'] });
    expect(payload.evidence.map((e: { id: string }) => e.id)).toEqual(['c-1']);
    expect(payload.gaps).toEqual([{ question: 'What conversion target?', answer: '15%' }]);
    expect(payload.pastDecisions.length).toBeGreaterThan(0);
    expect(payload.pastDecisions.every((d: { id: string }) => d.id !== 'd-trial')).toBe(true);
  });

  it('F-10: maps Claude’s branches to open top-level options with their ratings, evidence and linked decision', async () => {
    const ai = fakeAi({
      options: {
        options: [
          { label: 'Usage limit', summary: 's', pros: ['p'], cons: ['c'], score: 72, criteria: { impact: 4, effort: 2, risk: 2, evidence: 3 }, contextIds: ['c-1'], linkedDecisionId: 'd-pricing-seats' },
          { label: 'Time limit', summary: 's', pros: [], cons: [], score: 40, criteria: { impact: 2, effort: 1, risk: 3, evidence: 1 }, contextIds: [], linkedDecisionId: null },
        ],
      },
    });
    const options = await fetchOptions(ai, decision, state());
    expect(options.map((o) => [o.label, o.parentId, o.state, o.score])).toEqual([
      ['Usage limit', null, 'open', 72],
      ['Time limit', null, 'open', 40],
    ]);
    expect(options[0]).toMatchObject({ contextIds: ['c-1'], linkedDecisionId: 'd-pricing-seats', criteria: { impact: 4 } });
    expect(options[1].linkedDecisionId).toBeUndefined();
  });

  it('F-10: new branches never take the id of an option the PM added', async () => {
    const mine: OptionNode = { id: 'o-trial-1', decisionId: 'd-trial', parentId: null, label: 'Mine', summary: '', pros: [], cons: [], score: 0, contextIds: [], state: 'open' };
    // The PM's own options use the o-user- prefix; anything else with a clashing id is replaced by the new set.
    const userOwn = { ...mine, id: 'o-user-1' };
    const options = await fetchOptions(fakeAi(), decision, state({ options: [userOwn] }));
    expect(options.every((o) => o.id !== 'o-user-1')).toBe(true);
    expect(new Set(options.map((o) => o.id)).size).toBe(options.length);
  });

  it('F-10: a failure comes back as an error, never a made-up set of options', async () => {
    await expect(fetchOptions(fakeAi({ options: 'provider_busy' }), decision, state())).rejects.toMatchObject({ code: 'provider_busy' });
  });
});
