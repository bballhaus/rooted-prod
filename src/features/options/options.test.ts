import { describe, expect, it } from 'vitest';
import { citableContext, generateOptions, parseEitherOr, pickTemplate } from '../../agent/options';
import type { ContextItem, Decision, Gap } from '../../types';

function decision(question: string, patch: Partial<Decision> = {}): Decision {
  return {
    id: 'd-test',
    question,
    notes: 'Trial-to-paid conversion slipped from 14% to 11% this quarter.',
    links: [],
    constraints: ['No new eng headcount'],
    status: 'brief',
    createdAt: '2026-10-20T17:00:00.000Z',
    ...patch,
  };
}

function item(id: string, patch: Partial<ContextItem> = {}): ContextItem {
  return {
    id,
    decisionId: 'd-test',
    origin: 'slack',
    sourceLabel: '#growth',
    author: 'Sam (Growth eng)',
    date: '2026-10-14',
    snippet: 'Most trials that convert hit the usage limit in week one.',
    group: 'Usage',
    flaggedInaccurate: false,
    userEdited: false,
    removed: false,
    ...patch,
  };
}

const items: ContextItem[] = [
  item('c-1'),
  item('c-2', {
    sourceLabel: '#customer-feedback',
    snippet: 'Admins say 14 days is too short to get legal sign-off.',
  }),
  item('c-3', { snippet: 'Removed: old pricing thread.', removed: true }),
  item('c-4', {
    snippet: 'Flagged: wrong conversion number.',
    flaggedInaccurate: true,
  }),
  item('c-5', {
    decisionId: 'd-other',
    snippet: 'Belongs to another decision.',
  }),
];
const gaps: Gap[] = [
  {
    id: 'g-1',
    decisionId: 'd-test',
    question: 'How many trials hit the limit before day 14?',
  },
];

describe('generateOptions', () => {
  it('F-10: returns 2–4 open top-level options with label, summary, pros, cons and a 0–100 score', () => {
    const questions = [
      'Should the trial use a usage limit or a 14-day time limit?',
      'Build or buy an SSO integration?',
      'How should we price the API add-on?',
      'Ship the Salesforce sync this quarter?',
      'Redesign the billing settings page',
    ];
    for (const q of questions) {
      const opts = generateOptions(decision(q), items, gaps);
      expect(opts.length).toBeGreaterThanOrEqual(2);
      expect(opts.length).toBeLessThanOrEqual(4);
      for (const o of opts) {
        expect(o.parentId).toBeNull();
        expect(o.state).toBe('open');
        expect(o.decisionId).toBe('d-test');
        expect(o.label).not.toBe('');
        expect(o.summary).not.toBe('');
        expect(o.pros.length).toBeGreaterThan(0);
        expect(o.cons.length).toBeGreaterThan(0);
        expect(o.score).toBeGreaterThanOrEqual(0);
        expect(o.score).toBeLessThanOrEqual(100);
      }
      expect(new Set(opts.map((o) => o.id)).size).toBe(opts.length);
    }
  });

  it('F-10: is deterministic for the same inputs', () => {
    const d = decision('Should the trial use a usage limit or a 14-day time limit?');
    expect(generateOptions(d, items, gaps)).toEqual(generateOptions(d, items, gaps));
  });

  it('F-10: cites only non-removed, non-flagged context for this decision', () => {
    const opts = generateOptions(decision('Should the trial use a usage limit or a 14-day time limit?'), items, gaps);
    const cited = opts.flatMap((o) => o.contextIds);
    expect(cited.sort()).toEqual(['c-1', 'c-2']);
    expect(citableContext('d-test', items).map((c) => c.id)).toEqual(['c-1', 'c-2']);
  });

  it('F-10: parses "X or Y?" questions into two branches plus a gather-evidence branch', () => {
    expect(parseEitherOr('Should onboarding use a checklist or a guided tour?')).toEqual(['Checklist', 'Guided tour']);
    expect(parseEitherOr('Charge per seat or per workspace for the Team plan?')).toEqual(['Per seat', 'Per workspace']);
    expect(parseEitherOr('Ship dark mode or not?')).toBeNull();
    const opts = generateOptions(decision('Should onboarding use a checklist or a guided tour?'), [], []);
    expect(opts.map((o) => o.label)).toEqual(['Checklist', 'Guided tour', 'Gather more evidence first']);
  });

  it('F-10: picks build vs buy, pricing, now vs later and generic templates', () => {
    expect(pickTemplate('Build or buy an SSO integration?')).toBe('build-vs-buy');
    expect(pickTemplate('How should we price the API add-on?')).toBe('pricing');
    expect(pickTemplate('Ship the Salesforce sync this quarter?')).toBe('now-vs-later');
    expect(pickTemplate('Redesign the billing settings page')).toBe('generic');
    const generic = generateOptions(decision('Redesign the billing settings page'), items, gaps);
    expect(generic.some((o) => /evidence/i.test(o.label))).toBe(true);
    const buy = generateOptions(decision('Build or buy an SSO integration?'), [], []);
    expect(buy.map((o) => o.label)).toContain('Buy a vendor tool');
  });

  it('F-10: the gather-evidence branch names an open gap from the brief', () => {
    const opts = generateOptions(decision('Redesign the billing settings page'), items, gaps);
    const defer = opts.find((o) => o.label === 'Gather more evidence first')!;
    expect(defer.pros.join(' ')).toContain('How many trials hit the limit before day 14?');
  });
});
