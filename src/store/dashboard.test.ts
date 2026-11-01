import { describe, expect, it } from 'vitest';
import { demoUser, seedState } from '../data/fixtures';
import type { AppState } from '../types';
import { addDaysIso, inboxItems, mapStatus, ownerOf, visibleLinks, workspaceTags } from './dashboard';

const TODAY = '2026-10-31';

function state(patch: Partial<AppState> = {}): AppState {
  return { ...seedState(), user: structuredClone(demoUser), ...patch };
}

const byId = (s: AppState, id: string) => s.decisions.find((d) => d.id === id)!;

describe('mapStatus', () => {
  it('F-16: a decided decision past its review date with no outcome is due', () => {
    const s = state();
    expect(mapStatus(byId(s, 'd-onboarding-checklist'), s, TODAY)).toBe('outcome-due');
    expect(mapStatus(byId(s, 'd-pricing-seats'), s, TODAY)).toBe('decided');
    expect(mapStatus(byId(s, 'd-activation-metric'), s, TODAY)).toBe('outcome-logged');
    expect(mapStatus(byId(s, 'd-trial-card'), s, TODAY)).toBe('open');
  });
});

describe('inboxItems', () => {
  it('F-16: lists outcomes due on my decisions first, and only mine', () => {
    const s = state();
    const items = inboxItems(s, TODAY);
    const due = items.filter((i) => i.due);
    expect(due.map((i) => i.decisionId)).toEqual(
      expect.arrayContaining(['d-onboarding-checklist', 'd-digest-cadence']),
    );
    // Maya's checklist-copy outcome is due too, but it's her decision.
    expect(items.some((i) => i.decisionId === 'd-checklist-copy' && i.kind === 'outcome-due')).toBe(false);
    // Everything due comes before everything that isn't.
    expect(items.slice(0, due.length).every((i) => i.due)).toBe(true);
  });

  it('includes new suggestions and AI links waiting for a decision, but not dismissed ones', () => {
    const s = state();
    expect(inboxItems(s, TODAY).filter((i) => i.kind === 'suggestion')).toHaveLength(3);
    expect(inboxItems(s, TODAY).filter((i) => i.kind === 'link')).toHaveLength(3);
    const dismissed = state({
      suggestions: s.suggestions.map((x) => ({ ...x, status: 'dismissed' as const })),
      links: s.links.map((l) => (l.origin === 'ai' ? { ...l, status: 'dismissed' as const } : l)),
    });
    expect(inboxItems(dismissed, TODAY).some((i) => i.kind === 'suggestion' || i.kind === 'link')).toBe(false);
    expect(visibleLinks(dismissed).every((l) => l.origin === 'user')).toBe(true);
  });

  it('flags a deadline within three days on an open decision of mine', () => {
    const s = state();
    const soon = state({
      decisions: s.decisions.map((d) => (d.id === 'd-trial-card' ? { ...d, deadline: addDaysIso(TODAY, 2) } : d)),
    });
    expect(inboxItems(soon, TODAY).find((i) => i.kind === 'deadline')?.decisionId).toBe('d-trial-card');
    const later = state({
      decisions: s.decisions.map((d) => (d.id === 'd-trial-card' ? { ...d, deadline: addDaysIso(TODAY, 10) } : d)),
    });
    expect(inboxItems(later, TODAY).some((i) => i.kind === 'deadline')).toBe(false);
  });
});

describe('ownerOf and tags', () => {
  it('a decision with no owner belongs to the signed-in PM', () => {
    const s = state();
    expect(ownerOf({ ...byId(s, 'd-onboarding-checklist'), ownerId: undefined }, s)?.name).toBe('Jordan Lee');
    expect(ownerOf(byId(s, 'd-q4-bet'), s)?.name).toBe('Rafael Ortiz');
  });

  it('workspace tags are ordered by use', () => {
    const tags = workspaceTags(state());
    expect(tags.indexOf('pricing')).toBeLessThan(tags.indexOf('metrics'));
  });
});
