import { buildBrief } from '../agent/brief';
import { demoUser, seedState } from '../data/fixtures';
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

  function withBrief() {
    const s0 = { ...seedState(), user: structuredClone(demoUser) };
    s0.sources = s0.sources.map((s) => (s.type === 'google-drive' ? { ...s, connected: true } : s));
    const decision = {
      id: 'd-trial',
      question: 'Extend the free trial from 14 to 21 days?',
      notes: 'Trial-to-paid conversion and activation for new admins.',
      links: [],
      constraints: [],
      status: 'brief' as const,
      createdAt: '2026-10-28T00:00:00.000Z',
    };
    s0.decisions.push(decision);
    const { items, gaps } = buildBrief(decision, s0);
    return reducer(s0, { type: 'setBrief', decisionId: decision.id, items, gaps });
  }

  it('F-02: un-allowing a channel drops context already gathered from it', () => {
    const s1 = withBrief();
    const label = s1.contextItems.find((c) => c.origin === 'slack')?.sourceLabel;
    expect(label).toBeDefined();
    const channel = s1.sources.find((s) => s.type === 'slack')!.channels.find((c) => c.name === label)!;
    const s2 = reducer(s1, { type: 'setChannelAllowed', sourceId: 'src-slack', channelId: channel.id, allowed: false });
    expect(s2.contextItems.some((c) => c.origin === 'slack' && c.sourceLabel === label)).toBe(false);
    expect(s2.contextItems.some((c) => c.origin === 'past-decision' || c.origin === 'user-note')).toBe(true);
  });

  it('F-23: disconnecting a source drops everything gathered from it', () => {
    const s1 = withBrief();
    expect(s1.contextItems.some((c) => c.origin === 'slack')).toBe(true);
    const s2 = reducer(s1, { type: 'updateSource', sourceId: 'src-slack', patch: { connected: false } });
    expect(s2.contextItems.some((c) => c.origin === 'slack')).toBe(false);
    const s3 = reducer(s1, { type: 'updateSource', sourceId: 'src-drive', patch: { connected: false } });
    expect(s3.contextItems.some((c) => c.origin === 'drive')).toBe(false);
    expect(s3.contextItems.some((c) => c.origin === 'slack')).toBe(true);
  });
});
