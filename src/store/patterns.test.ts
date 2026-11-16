import { describe, expect, it } from 'vitest';
import { demoState } from '../data/demoFixtures';
import { signedInState } from '../test/render';
import type { AppState, Decision } from '../types';
import { decisionStats, patternDecisions } from './patterns';

const TODAY = '2026-11-13';

function decision(id: string, patch: Partial<Decision> = {}): Decision {
  return { id, question: id, notes: '', links: [], constraints: [], status: 'decided', createdAt: '2026-11-01T12:00:00.000Z', ...patch };
}

function stateWith(decisions: Decision[], outcomes: AppState['outcomes'] = []): AppState {
  return { ...signedInState(), decisions, outcomes, options: [], links: [] };
}

describe('decision stats (F-R3-05)', () => {
  it('F-R3-05: leaves planted directions out of the history', () => {
    const s = demoState(TODAY);
    const real = patternDecisions(s);
    expect(real.some((d) => d.speculative)).toBe(false);
    expect(real.length).toBe(s.decisions.filter((d) => !d.speculative).length);
  });

  it('F-R3-05: counts decisions in each of the last six months, this month last', () => {
    const ds = [
      decision('a', { loggedAt: '2026-11-02T12:00:00.000Z' }),
      decision('b', { loggedAt: '2026-11-03T12:00:00.000Z' }),
      decision('c', { loggedAt: '2026-06-10T12:00:00.000Z' }),
      decision('old', { loggedAt: '2026-01-10T12:00:00.000Z' }),
    ];
    const st = decisionStats(stateWith(ds), ds, TODAY);
    expect(st.months.map((m) => m.key)).toEqual(['2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11']);
    expect(st.months.map((m) => m.count)).toEqual([1, 0, 0, 0, 0, 2]);
    // Three in six months is too few to call a direction.
    expect(st.trend).toBeNull();
  });

  it('F-R3-05: calls a trend only with enough decisions, comparing the last three full months to the three before', () => {
    const at = (m: string) => `2026-${m}-10T12:00:00.000Z`;
    const up = ['05', '08', '09', '10', '10'].map((m, i) => decision(`u${i}`, { loggedAt: at(m) }));
    expect(decisionStats(stateWith(up), up, TODAY).trend).toBe('up');
    const down = ['05', '06', '06', '07', '10'].map((m, i) => decision(`d${i}`, { loggedAt: at(m) }));
    expect(decisionStats(stateWith(down), down, TODAY).trend).toBe('down');
    const flat = ['05', '06', '09', '10'].map((m, i) => decision(`f${i}`, { loggedAt: at(m) }));
    expect(decisionStats(stateWith(flat), flat, TODAY).trend).toBe('steady');
  });

  it('F-R3-05: the month under way doesn’t count toward the trend, so a steady pace reads steady on the 1st', () => {
    const months = ['06', '07', '08', '09', '10', '11'];
    const steady = months.flatMap((m) => [1, 2].map((n) => decision(`s${m}${n}`, { loggedAt: `2026-${m}-1${n}T12:00:00.000Z` })));
    const st = decisionStats(stateWith(steady), steady, '2026-12-01');
    expect(st.months.at(-1)).toMatchObject({ key: '2026-12', count: 0 });
    expect(st.trendCounts).toEqual({ recent: 6, before: 6 });
    expect(st.trend).toBe('steady');
  });

  it('F-R3-05: reports the median days to decide, and how outcomes turned out', () => {
    const ds = [
      decision('a', { createdAt: '2026-10-01T12:00:00.000Z', loggedAt: '2026-10-03T12:00:00.000Z', reviewDate: '2026-11-01' }),
      decision('b', { createdAt: '2026-10-01T12:00:00.000Z', loggedAt: '2026-10-11T12:00:00.000Z', reviewDate: '2026-11-10' }),
      decision('c', { createdAt: '2026-10-01T12:00:00.000Z', loggedAt: '2026-10-21T12:00:00.000Z', reviewDate: '2026-12-01' }),
      decision('open', { status: 'options' }),
    ];
    const outcomes = [{ id: 'o', decisionId: 'a', result: 'mixed' as const, summary: '', metrics: '', loggedAt: '2026-11-02' }];
    const st = decisionStats(stateWith(ds, outcomes), ds, TODAY);
    expect(st).toMatchObject({ total: 4, decided: 3, inProgress: 1, medianDaysToDecide: 10 });
    expect(st.outcomes).toMatchObject({ logged: 1, mixed: 1, worked: 0 });
    // a and b came due; only a has an outcome, so b is overdue.
    expect(st).toMatchObject({ reviewsDue: 2, reviewsLogged: 1, overdue: 1 });
  });

  it('F-R3-05: groups by goal, most decisions first', () => {
    const ds = [decision('a', { metric: 'Activation' }), decision('b', { metric: 'Expansion' }), decision('c', { metric: 'Expansion' })];
    const st = decisionStats(stateWith(ds), ds, TODAY);
    expect(st.goals.map((g) => [g.goal, g.count])).toEqual([
      ['Expansion', 2],
      ['Activation', 1],
    ]);
  });

  it('works with no decisions at all', () => {
    const st = decisionStats(stateWith([]), [], TODAY);
    expect(st).toMatchObject({ total: 0, medianDaysToDecide: null, trend: null, reviewsDue: 0, goals: [] });
  });
});
