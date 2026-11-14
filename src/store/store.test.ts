import { demoState } from '../data/demoFixtures';
import { demoUser, emptyWorkspaceState, seedState } from '../data/fixtures';
import { briefFor } from '../test/brief';
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
    const { items, gaps } = briefFor(decision, s0);
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

describe('privacy of suggestions', () => {
  it('F-02, F-23: revoking a channel drops suggestions that quote it; disconnecting Slack drops all Slack ones', () => {
    const base = { ...seedState() };
    const noFeedback = reducer(base, { type: 'setChannelAllowed', sourceId: 'src-slack', channelId: 'ch-support', allowed: false });
    expect(noFeedback.suggestions.map((s) => s.id)).toEqual(['sg-checklist-sync']);
    const disconnected = reducer(base, { type: 'updateSource', sourceId: 'src-slack', patch: { connected: false } });
    expect(disconnected.suggestions).toEqual([]);
  });
});

describe('demo mode and outcomes', () => {
  it('loadDemo swaps in a connected forest and marks the workspace as demo, keeping the user', () => {
    const s0 = { ...seedState(), user: structuredClone(demoUser) };
    const s1 = reducer(s0, { type: 'loadDemo' });
    expect(s1.demo).toBe(true);
    expect(s1.user?.name).toBe('Jordan Lee');
    // Its own planted world, with causal links between its decisions and at least one direction.
    expect(s1.decisions.some((d) => d.id === 'd-self-serve-expansion')).toBe(true);
    const ids = new Set(s1.decisions.map((d) => d.id));
    expect(s1.links.length).toBeGreaterThan(0);
    expect(s1.links.every((l) => ids.has(l.fromId) && ids.has(l.toId) && l.kind === 'builds-on')).toBe(true);
    expect(s1.decisions.some((d) => d.speculative)).toBe(true);
    expect(s1.outcomes.every((o) => ids.has(o.decisionId))).toBe(true);
  });

  it('exitDemo brings back the PM’s own workspace as they left it, and clears the demo flag', () => {
    const mine = {
      id: 'd-mine',
      question: 'Ship the beta to five design partners?',
      notes: '',
      links: [],
      constraints: [],
      status: 'framing' as const,
      createdAt: '2026-11-01T10:00:00.000Z',
    };
    const own = reducer({ ...seedState(), user: structuredClone(demoUser) }, { type: 'createDecision', decision: mine });
    const demo = reducer(own, { type: 'loadDemo' });
    expect(demo.decisions.some((d) => d.id === 'd-mine')).toBe(false);
    const s1 = reducer(demo, { type: 'exitDemo' });
    expect(s1.demo).toBe(false);
    expect(s1.user?.name).toBe('Jordan Lee');
    expect(s1.decisions).toEqual(own.decisions);
    expect(s1.beforeDemo).toBeUndefined();
  });

  it('F-02, 0017: the demo reads its own sample sources, never the PM’s live Slack, and leaving restores theirs', () => {
    const live = { id: 'src-slack', type: 'slack' as const, name: 'Acme Slack', connected: true, channels: [{ id: 'C1', name: '#pricing', memberCount: 4, allowed: true }] };
    const s0 = { ...emptyWorkspaceState(), user: structuredClone(demoUser), sources: [live] };
    const demo = reducer(s0, { type: 'loadDemo' });
    expect(demo.sources.every((x) => x.sample)).toBe(true);
    const back = reducer(demo, { type: 'exitDemo' });
    expect(back.sources).toEqual([live]);
  });

  it('F-23: deleting everything from inside the demo disconnects the PM’s own sources, not the demo’s', () => {
    const live = { id: 'src-slack', type: 'slack' as const, name: 'Acme Slack', connected: true, channels: [] };
    const demo = reducer({ ...emptyWorkspaceState(), user: structuredClone(demoUser), sources: [live] }, { type: 'loadDemo' });
    const s1 = reducer(demo, { type: 'deleteAllData' });
    expect(s1.sources).toEqual([{ ...live, connected: false, connectedAt: undefined }]);
    expect(s1.sources.some((x) => x.sample)).toBe(false);
  });

  it('F-23: deleting all data in the demo deletes the saved workspace too and leaves the demo', () => {
    const demo = reducer({ ...seedState(), user: structuredClone(demoUser) }, { type: 'loadDemo' });
    const s1 = reducer(demo, { type: 'deleteAllData' });
    expect(s1.demo).toBe(false);
    expect(s1.beforeDemo).toBeUndefined();
    expect(s1.decisions).toEqual([]);
  });

  it('F-16: logOutcome records the result for the decision without changing its status', () => {
    const s0 = seedState();
    const d0 = s0.decisions[0];
    const s1 = reducer(s0, {
      type: 'logOutcome',
      outcome: {
        id: 'out-test',
        decisionId: d0.id,
        result: 'worked',
        summary: 'It worked',
        metrics: 'Activation +7',
        loggedAt: '2026-11-01T00:00:00.000Z',
      },
    });
    const o = s1.outcomes.find((x) => x.decisionId === d0.id);
    expect(o?.summary).toBe('It worked');
    expect(o?.metrics).toBe('Activation +7');
    expect(s1.decisions.find((x) => x.id === d0.id)?.status).toBe(d0.status);
  });
});

describe('demo dates', () => {
  it('the demo is dated relative to today, so its outcomes stay in the past', () => {
    const early = demoState('2026-11-02');
    const later = demoState('2027-03-02');
    const at = (s: ReturnType<typeof demoState>, id: string) => s.decisions.find((d) => d.id === id)!;
    expect(at(early, 'd-activation-metric').createdAt).toBe('2026-05-07T16:00:00.000Z');
    // 120 days later, everything moves by 120 days.
    expect(at(later, 'd-activation-metric').createdAt).toBe('2026-09-04T16:00:00.000Z');
    expect(at(later, 'd-onboarding-checklist').reviewDate).toBe(
      new Date(Date.parse(`${at(early, 'd-onboarding-checklist').reviewDate}T00:00:00Z`) + 120 * 86_400_000)
        .toISOString()
        .slice(0, 10),
    );
    expect(later.outcomes.every((o) => o.loggedAt < '2027-03-02')).toBe(true);
  });
});

describe('sign-in', () => {
  const identity = { authId: 'auth-a', email: 'a@startup.example', name: 'Ada Park', provider: 'google' as const };

  it('F-01: a real sign-in sets the PM’s name on their teammate card too', () => {
    const s1 = reducer(seedState(), { type: 'signIn', identity });
    expect(s1.user).toMatchObject({ authId: 'auth-a', name: 'Ada Park', email: 'a@startup.example', signInProvider: 'google' });
    expect(s1.teammates.find((t) => t.id === s1.user!.id)).toMatchObject({ name: 'Ada Park', initials: 'AP' });
  });

  it('F-01: signing in again as the same person changes nothing they edited', () => {
    const s1 = reducer(reducer(seedState(), { type: 'signIn', identity }), { type: 'updateUser', patch: { name: 'Ada P.', role: 'PM' } });
    const s2 = reducer(s1, { type: 'signIn', identity });
    expect(s2).toBe(s1);
  });

  it('F-01: after a sign-out, someone else signing in on this browser starts from a fresh workspace', () => {
    const mine = { id: 'd-ada', question: 'Ada’s call?', notes: '', links: [], constraints: [], status: 'framing' as const, createdAt: '2026-11-01T00:00:00.000Z' };
    const ada = reducer(reducer(seedState(), { type: 'signIn', identity }), { type: 'createDecision', decision: mine });
    const out = reducer(ada, { type: 'signOut' });
    const ben = reducer(out, { type: 'signIn', identity: { ...identity, authId: 'auth-b', email: 'b@startup.example', name: 'Ben Ito' } });
    expect(ben.decisions.some((d) => d.id === 'd-ada')).toBe(false);
    expect(ben.messages).toEqual([]);
    expect(ben.user).toMatchObject({ authId: 'auth-b', name: 'Ben Ito' });
  });

  it('F-01: signing out and back in as the same person keeps their workspace and profile', () => {
    const mine = { id: 'd-ada', question: 'Ada’s call?', notes: '', links: [], constraints: [], status: 'framing' as const, createdAt: '2026-11-01T00:00:00.000Z' };
    const ada = reducer(
      reducer(reducer(seedState(), { type: 'signIn', identity }), { type: 'createDecision', decision: mine }),
      { type: 'updateUser', patch: { name: 'Ada P.', role: 'PM', defaultReviewDays: 60 } },
    );
    const back = reducer(reducer(ada, { type: 'signOut' }), { type: 'signIn', identity });
    expect(back.decisions.some((d) => d.id === 'd-ada')).toBe(true);
    expect(back.user).toMatchObject({ name: 'Ada P.', role: 'PM', defaultReviewDays: 60 });
  });

  it('F-01: someone else signing in on this browser starts from a fresh workspace', () => {
    const mine = { id: 'd-ada', question: 'Ada’s call?', notes: '', links: [], constraints: [], status: 'framing' as const, createdAt: '2026-11-01T00:00:00.000Z' };
    const s1 = reducer(reducer(seedState(), { type: 'signIn', identity }), { type: 'createDecision', decision: mine });
    const s2 = reducer(s1, { type: 'signIn', identity: { ...identity, authId: 'auth-b', email: 'b@startup.example', name: 'Ben Ito' } });
    expect(s2.decisions.some((d) => d.id === 'd-ada')).toBe(false);
    expect(s2.user).toMatchObject({ authId: 'auth-b', name: 'Ben Ito', role: '' });
  });
});

describe('Rooted’s insights (F-R3-05)', () => {
  const at = '2026-11-13T12:00:00.000Z';
  const base = { ...seedState(), user: { ...demoUser, authId: 'auth-a' } };
  const [a, b] = base.decisions;
  const insight = (id: string, decisionIds = [a.id, b.id]) => ({
    id,
    kind: 'pattern' as const,
    title: id,
    detail: '',
    decisionIds,
    foundAt: at,
    userEdited: false,
    dismissed: false,
  });

  it('F-R3-05: are saved for the person and workspace that asked', () => {
    const s = reducer(base, { type: 'setInsights', insights: [insight('i1')], forUser: 'auth-a', demo: false });
    expect(s.insights.map((i) => i.id)).toEqual(['i1']);
  });

  it('F-01, F-23: are dropped if someone else is signed in, the demo was swapped, or the decisions they cite are gone', () => {
    expect(reducer(base, { type: 'setInsights', insights: [insight('i1')], forUser: 'auth-b', demo: false }).insights).toEqual([]);
    expect(reducer(base, { type: 'setInsights', insights: [insight('i1')], forUser: 'auth-a', demo: true }).insights).toEqual([]);
    const wiped = reducer(base, { type: 'deleteAllData' });
    expect(reducer(wiped, { type: 'setInsights', insights: [insight('i1')], forUser: 'auth-a', demo: false }).insights).toEqual([]);
    expect(reducer(base, { type: 'setInsights', insights: [insight('i2', [a.id, 'd-gone'])], forUser: 'auth-a', demo: false }).insights).toEqual([]);
  });
});
