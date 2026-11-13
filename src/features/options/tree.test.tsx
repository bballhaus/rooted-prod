import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { fetchSubOptions } from '../../agent/options';
import { draftRecord } from '../../agent/record';
import { fakeAi } from '../../test/fakeAi';
import { sampleOptions } from '../../test/options';
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

const top = sampleOptions(trial, items);

// Sub-options as Claude might return them for the first branch.
const SUB_LABELS = ['Pilot with 5 design partners', 'All new signups', 'Self-serve only'];
function subsOf(parent: OptionNode, labels: string[] = SUB_LABELS): OptionNode[] {
  return labels.map((label, i) => ({
    ...parent,
    id: `o-sub-${parent.id.replace(/^o-/, '')}-${i + 1}`,
    parentId: parent.id,
    label,
    summary: `${label}.`,
    contextIds: [],
    state: 'open' as const,
  }));
}
const draftOf = (label: string) => ({
  label,
  summary: `${label}.`,
  pros: ['Fast'],
  cons: ['Narrow'],
  score: 60,
  criteria: { impact: 3, effort: 2, risk: 2, evidence: 1 },
  contextIds: [],
  linkedDecisionId: null,
});

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

describe('fetchSubOptions', () => {
  it('F-10: sub-options point at their branch, with fresh ids and the ratings Claude gave', async () => {
    const parent = top[0];
    const ai = fakeAi({ subOptions: { options: [draftOf('Pilot'), draftOf('Everyone')] } });
    const existing = subsOf(parent, ['Earlier sub-option']);
    const subs = await fetchSubOptions(ai, trial, parent, state([...top, ...existing]));
    expect(subs.map((s) => [s.label, s.parentId, s.state])).toEqual([
      ['Pilot', parent.id, 'open'],
      ['Everyone', parent.id, 'open'],
    ]);
    expect(subs.every((s) => !existing.some((e) => e.id === s.id))).toBe(true);
    expect(subs[0].criteria).toEqual({ impact: 3, effort: 2, risk: 2, evidence: 1 });
    // Claude is told which sub-options exist, so it doesn't repeat them.
    expect(ai.run.mock.calls[0][1].siblings).toEqual(['Earlier sub-option']);
  });

  it('F-10, F-08: only evidence the PM still trusts is sent', async () => {
    const ai = fakeAi();
    const flagged = items.map((c) => (c.id === 'c-t1' ? { ...c, flaggedInaccurate: true } : c));
    await fetchSubOptions(ai, trial, top[0], { ...state(), contextItems: flagged });
    expect(ai.run.mock.calls[0][1].evidence.map((e: { id: string }) => e.id)).toEqual(['c-t-past']);
  });

  it('F-28: sub-options drafted under the PM’s own option are still agent output', async () => {
    const mine: OptionNode = { ...top[0], id: 'o-user-abc', label: 'Annual-only trial', score: 0 };
    const subs = await fetchSubOptions(fakeAi(), trial, mine, state([...top, mine]));
    expect(subs.length).toBeGreaterThan(0);
    expect(subs.every((s) => !s.id.startsWith('o-user-'))).toBe(true);
  });
});

describe('Decision tree graph', () => {
  it('F-10: an edit made while the agent is branching out is kept', async () => {
    let answer: (v: unknown) => void = () => {};
    const ai = fakeAi({ subOptions: () => new Promise((resolve) => (answer = resolve)) });
    const { user } = renderApp('/decisions/d-trial/options', state(), { ai });
    const [first, second] = top;
    await user.click(screen.getByRole('button', { name: `Branch out ${first.label}` }));
    // Prune another branch before the sub-options arrive.
    await user.click(screen.getByRole('button', { name: `Prune ${second.label}` }));
    await user.type(screen.getByLabelText('Why are you pruning this branch?'), 'Legal sign-off takes longer');
    await user.click(screen.getByRole('button', { name: 'Prune branch' }));
    answer({ options: SUB_LABELS.map(draftOf) });
    await screen.findByRole('heading', { level: 2, name: `Sub-options of “${first.label}”` }, { timeout: 3000 });
    await user.click(screen.getByRole('button', { name: 'Top-level options' }));
    expect(screen.getByText('Legal sign-off takes longer')).toBeInTheDocument();
  });

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
    const ai = fakeAi({ subOptions: { options: SUB_LABELS.map(draftOf) } });
    const { user } = renderApp('/decisions/d-trial/options', state(), { ai });
    const first = top[0];
    await user.click(screen.getByRole('button', { name: `Branch out ${first.label}` }));
    expect(
      await screen.findByRole('heading', { level: 2, name: `Sub-options of “${first.label}”` }, { timeout: 3000 }),
    ).toBeInTheDocument();
    expect(node(/^.* › Pilot with 5 design partners\./)).toBeInTheDocument();
    expect(ai.run).toHaveBeenCalledWith('subOptions', expect.objectContaining({ parent: expect.objectContaining({ id: first.id }) }));
    expect(screen.getByRole('heading', { level: 3, name: 'Pilot with 5 design partners' })).toBeInTheDocument();
    // Back to the top level from the breadcrumb.
    await user.click(screen.getByRole('button', { name: 'Top-level options' }));
    expect(screen.getByRole('heading', { level: 2, name: 'Top-level options' })).toBeInTheDocument();
  });

  it('F-11: picking a node in the graph shows its level in the cards; collapsing hides its sub-options', async () => {
    const subs = subsOf(top[0]);
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
    const subs = subsOf(top[0]);
    const { user } = renderApp('/decisions/d-trial/options', state([...top, ...subs]));
    await user.click(screen.getByRole('button', { name: `Sub-options (${subs.length}) of ${top[0].label}` }));
    const subCard = screen.getByRole('heading', { level: 3, name: 'All new signups' }).closest('li')!;
    await user.click(within(subCard).getByRole('button', { name: /choose this branch/i }));
    expect(document.querySelectorAll('.options-node-chosen')).toHaveLength(1);
    expect(node(/› All new signups\. Your choice\./)).toHaveClass('options-node-chosen');
    expect(document.querySelectorAll('.options-card.card-rec')).toHaveLength(1);
  });

  it('F-11: options under a pruned branch can’t be chosen until it is restored', async () => {
    const subs = subsOf(top[0]);
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
  it('F-15: asks for reasons only for the alternatives off the chosen path', async () => {
    const subs = subsOf(top[0]);
    const all = [...top, ...subs];
    const ai = fakeAi();
    const draft = await draftRecord(ai, trial, all, subs[1].id, 'All new signups first.', state(all));
    const ids = draft.rejected.map((r) => r.optionId).sort();
    const expected = [...top.slice(1).map((o) => o.id), subs[0].id, subs[2].id].sort();
    expect(ids).toEqual(expected);
    expect(ai.run.mock.calls[0][1].others.map((o: { id: string }) => o.id).sort()).toEqual(expected);
  });
});
