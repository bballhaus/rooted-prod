import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { generateOptions, generateSubOptions } from '../../agent/options';
import { draftRecordNow } from '../../agent/record';
import { renderApp, signedInState } from '../../test/render';
import type { AppState, ContextItem, Decision, OptionNode } from '../../types';

const trial: Decision = {
  id: 'd-trial',
  question: 'Should the trial use a usage limit or a 14-day time limit?',
  notes: 'Trial-to-paid conversion slipped from 14% to 11% this quarter.',
  links: [],
  constraints: [],
  status: 'options',
  createdAt: '2026-10-20T17:00:00.000Z',
};

const items: ContextItem[] = [
  {
    id: 'c-t1',
    decisionId: 'd-trial',
    origin: 'slack',
    sourceLabel: '#growth',
    author: 'Sam (Growth eng)',
    date: '2026-10-14',
    snippet: 'Most trials that convert hit the usage limit in week one.',
    group: 'Usage',
    flaggedInaccurate: false,
    userEdited: false,
    removed: false,
  },
  {
    id: 'c-t-past',
    decisionId: 'd-trial',
    origin: 'past-decision',
    sourceLabel: 'Past decision: Charge per seat or per workspace for the Team plan?',
    date: '2026-09-18',
    snippet: 'Per workspace with a seat cap.',
    link: '/decisions/d-pricing-seats',
    group: 'Past decisions',
    flaggedInaccurate: false,
    userEdited: false,
    removed: false,
  },
];

const top = generateOptions(trial, items, []);

function state(options: OptionNode[] = top): AppState {
  const base = signedInState();
  return {
    ...base,
    decisions: [trial, ...base.decisions],
    contextItems: [...base.contextItems, ...items],
    options: [...base.options, ...options],
  };
}

const tree = () => screen.getByRole('region', { name: 'Decision tree' });
const node = (name: RegExp) => within(tree()).getByRole('button', { name });

describe('generateOptions criteria', () => {
  it('F-10: every option gets rough 1–5 ratings for impact, effort, risk and evidence', () => {
    for (const o of top) {
      for (const key of ['impact', 'effort', 'risk', 'evidence'] as const) {
        expect(o.criteria?.[key]).toBeGreaterThanOrEqual(1);
        expect(o.criteria?.[key]).toBeLessThanOrEqual(5);
      }
    }
  });
});

describe('generateSubOptions', () => {
  it('F-10: splits a branch into deterministic sub-options that point at it', () => {
    const parent = top[0];
    const subs = generateSubOptions(trial, parent, top, items);
    expect(subs.length).toBeGreaterThanOrEqual(2);
    expect(subs.every((s) => s.parentId === parent.id && s.state === 'open')).toBe(true);
    expect(new Set(subs.map((s) => s.id)).size).toBe(subs.length);
    expect(generateSubOptions(trial, parent, top, items)).toEqual(subs);
    // Each level splits along a different dimension.
    const deeper = generateSubOptions(trial, subs[0], [...top, ...subs], items);
    expect(deeper.map((s) => s.label)).not.toEqual(subs.map((s) => s.label));
    expect(deeper.every((s) => s.parentId === subs[0].id)).toBe(true);
  });

  it('F-10: sub-options only cite evidence their branch cited and the PM still trusts', () => {
    const parent = { ...top[0], contextIds: ['c-t1', 'c-gone'] };
    const subs = generateSubOptions(trial, parent, top, items);
    for (const s of subs) expect(s.contextIds.every((id) => id === 'c-t1')).toBe(true);
  });

  it('F-10: the gather-more-evidence branch splits into evidence steps', () => {
    const defer = top.find((o) => /gather more evidence/i.test(o.label))!;
    const subs = generateSubOptions(trial, defer, top, items);
    expect(subs.map((s) => s.label)).toContain('Run 5 customer calls');
  });
});

describe('Decision tree graph', () => {
  it('F-11: shows the decision, every branch, and the past decisions it builds on', () => {
    renderApp('/decisions/d-trial/options', state());
    expect(node(/^Decision/)).toBeInTheDocument();
    for (const o of top)
      expect(within(tree()).getByRole('button', { name: new RegExp(`^${o.label}\\.`) })).toBeInTheDocument();
    expect(within(tree()).getByRole('link', { name: /charge per seat or per workspace/i })).toHaveAttribute(
      'href',
      '/decisions/d-pricing-seats',
    );
  });

  it('F-10: branching out adds sub-options to the graph and opens them as cards', async () => {
    const { user } = renderApp('/decisions/d-trial/options', state());
    const first = top[0];
    await user.click(screen.getByRole('button', { name: `Branch out ${first.label}` }));
    expect(
      await screen.findByRole('heading', { level: 2, name: `Sub-options of “${first.label}”` }, { timeout: 3000 }),
    ).toBeInTheDocument();
    expect(node(/^.* › Pilot with 5 design partners\./)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Pilot with 5 design partners' })).toBeInTheDocument();
    // Back to the top level from the breadcrumb.
    await user.click(screen.getByRole('button', { name: 'Top-level options' }));
    expect(screen.getByRole('heading', { level: 2, name: 'Top-level options' })).toBeInTheDocument();
  });

  it('F-11: picking a node in the graph shows its level in the cards; collapsing hides its sub-options', async () => {
    const subs = generateSubOptions(trial, top[0], top, items);
    const { user } = renderApp('/decisions/d-trial/options', state([...top, ...subs]));
    await user.click(node(/› All new signups\./));
    expect(screen.getByRole('heading', { level: 2, name: `Sub-options of “${top[0].label}”` })).toBeInTheDocument();
    expect(node(/› All new signups\./)).toHaveAttribute('aria-current', 'true');

    await user.click(
      within(tree()).getByRole('button', { name: `Collapse the ${subs.length} sub-options of ${top[0].label}` }),
    );
    expect(within(tree()).queryByRole('button', { name: /› All new signups\./ })).not.toBeInTheDocument();
  });

  it('F-11: choosing a sub-option makes only that node and card wine', async () => {
    const subs = generateSubOptions(trial, top[0], top, items);
    const { user } = renderApp('/decisions/d-trial/options', state([...top, ...subs]));
    await user.click(screen.getByRole('button', { name: `Sub-options (${subs.length}) of ${top[0].label}` }));
    const subCard = screen.getByRole('heading', { level: 3, name: 'All new signups' }).closest('li')!;
    await user.click(within(subCard).getByRole('button', { name: /choose this branch/i }));
    expect(document.querySelectorAll('.options-node-chosen')).toHaveLength(1);
    expect(node(/› All new signups\. Your choice\./)).toHaveClass('options-node-chosen');
    expect(document.querySelectorAll('.options-card.card-rec')).toHaveLength(1);
  });

  it('F-11: options under a pruned branch can’t be chosen until it is restored', async () => {
    const subs = generateSubOptions(trial, top[0], top, items);
    const pruned = [{ ...top[0], state: 'pruned' as const, pruneReason: 'Too slow' }, ...top.slice(1), ...subs];
    const { user } = renderApp('/decisions/d-trial/options', state(pruned));
    await user.click(screen.getByRole('button', { name: `Sub-options (${subs.length}) of ${top[0].label}` }));
    expect(screen.queryByRole('button', { name: /^Choose this branch/ })).not.toBeInTheDocument();
    expect(node(/› All new signups\. Under a pruned branch\./)).toBeInTheDocument();
  });

  it('F-08: the PM can edit a branch’s ratings', async () => {
    const { user } = renderApp('/decisions/d-trial/options', state());
    const label = top[0].label;
    await user.click(screen.getByRole('button', { name: `Edit ${label}` }));
    const form = screen.getByRole('form', { name: `Edit ${label}` });
    await user.selectOptions(within(form).getByLabelText('Risk'), '5');
    await user.click(within(form).getByRole('button', { name: 'Save changes' }));
    expect(node(new RegExp(`^${label}\\..*Risk 5 of 5`))).toBeInTheDocument();
    expect(screen.getByText('Very high, 5 of 5')).toBeInTheDocument();
  });
});

describe('draftRecord with sub-options', () => {
  it('F-15: drafts reasons only for the alternatives off the chosen path', () => {
    const subs = generateSubOptions(trial, top[0], top, items);
    const all = [...top, ...subs];
    const draft = draftRecordNow(trial, all, subs[1].id, 'All new signups first.', items);
    const ids = draft.rejected.map((r) => r.optionId).sort();
    const expected = [...top.slice(1).map((o) => o.id), subs[0].id, subs[2].id].sort();
    expect(ids).toEqual(expected);
  });
});
