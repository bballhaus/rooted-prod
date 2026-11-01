import { describe, expect, it } from 'vitest';
import { demoUser, seedState } from '../../data/fixtures';
import { layoutMap, NODE_H, NODE_W, STANDALONE, threadOf } from './mapLayout';

const TODAY = '2026-10-31';
const state = () => ({ ...seedState(), user: structuredClone(demoUser) });

describe('layoutMap', () => {
  it('F-17: places every decision, later decisions further right', () => {
    const s = state();
    const { placed } = layoutMap(s.decisions, 'none', s, TODAY);
    expect(placed).toHaveLength(s.decisions.length);
    const x = (id: string) => placed.find((p) => p.decision.id === id)!.x;
    expect(x('d-activation-metric')).toBeLessThan(x('d-onboarding-checklist'));
    expect(x('d-onboarding-checklist')).toBeLessThan(x('d-referrals-timing'));
  });

  it('F-17: decisions in the same lane never overlap', () => {
    const s = state();
    for (const by of ['none', 'tag', 'owner', 'team', 'status'] as const) {
      const { placed } = layoutMap(s.decisions, by, s, TODAY);
      for (const a of placed) {
        for (const b of placed) {
          if (a === b) continue;
          const overlap = Math.abs(a.x - b.x) < NODE_W && Math.abs(a.y - b.y) < NODE_H;
          expect(overlap, `${by}: ${a.decision.id} overlaps ${b.decision.id}`).toBe(false);
        }
      }
    }
  });

  it('F-17: lanes by owner name each teammate who decided something', () => {
    const s = state();
    const { lanes } = layoutMap(s.decisions, 'owner', s, TODAY);
    const keys = lanes.map((l) => l.key);
    expect(keys).toEqual(expect.arrayContaining(['Jordan Lee', 'Rafael Ortiz', 'Dev Patel', 'Priya Raman']));
    // Lanes stack without gaps.
    for (let i = 1; i < lanes.length; i++) expect(lanes[i].y).toBe(lanes[i - 1].y + lanes[i - 1].height);
  });

  it('F-17: threads join decisions through confirmed links only, and name them by their most-used tag', () => {
    const s = state();
    const byId = (id: string) => s.decisions.find((d) => d.id === id)!;
    expect(threadOf(byId('d-activation-metric'), s)).toBe(threadOf(byId('d-sso-plan'), s));
    expect(threadOf(byId('d-mobile-push'), s)).toBe('#notifications');
    // The help-center link is only suggested by Rooted, so it doesn't join the onboarding thread.
    expect(threadOf(byId('d-help-center'), s)).toBe(STANDALONE);
    const accepted = {
      ...s,
      links: s.links.map((l) => (l.id === 'l-help-center--onboarding-checklist' ? { ...l, status: 'accepted' as const } : l)),
    };
    expect(threadOf(byId('d-help-center'), accepted)).toBe(threadOf(byId('d-onboarding-checklist'), accepted));
  });

  it('marks each month on the time axis', () => {
    const s = state();
    const { months } = layoutMap(s.decisions, 'none', s, TODAY);
    expect(months.map((m) => m.label)).toEqual(expect.arrayContaining(['Jun 2026', 'Oct 2026']));
  });
});
