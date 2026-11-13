import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { fakeAi } from '../../test/fakeAi';
import { sampleOptions } from '../../test/options';
import { STORAGE_KEY } from '../../store/store';
import { renderApp, signedInState } from '../../test/render';
import type { AppState, Decision } from '../../types';

const WAIT = { timeout: 3000 };
const stored = () => JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as AppState;

const trial: Decision = {
  id: 'd-trial',
  question: 'Should the trial use a usage limit or a 14-day time limit?',
  notes: 'Trial-to-paid slipped.',
  links: [],
  constraints: [],
  status: 'options',
  createdAt: '2026-10-20T17:00:00.000Z',
  ownerId: 'u-1',
  stakeholderIds: ['tm-ines'],
  tags: [{ label: 'trials', origin: 'user' }],
};

function withOptions(): AppState {
  const base = signedInState();
  const s = { ...base, decisions: [trial, ...base.decisions] };
  return { ...s, options: [...s.options, ...sampleOptions(trial, s.contextItems)] };
}

describe('Decision workspace', () => {
  it('F-04, F-06, F-10: frame, evidence and options are sections of one page', () => {
    renderApp('/decisions/d-trial/work', withOptions());
    expect(screen.getByRole('heading', { level: 1, name: trial.question })).toBeInTheDocument();
    expect(screen.getByText(/Your call · consulting Ines Moreau/)).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Frame' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Evidence' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Options' })).toBeInTheDocument();
  });

  it('F-11: a past decision can be added as an option, which links the two decisions', async () => {
    const { user } = renderApp('/decisions/d-trial/work', withOptions());
    const options = screen.getByRole('region', { name: 'Options' });
    await user.click(within(options).getByRole('button', { name: 'Reuse a past decision' }));
    await user.selectOptions(within(options).getByLabelText('Past decision'), 'd-pricing-seats');
    await user.click(within(options).getByRole('button', { name: 'Add as an option' }));
    expect(within(options).getByRole('heading', { name: 'Reuse: Per workspace with seat cap' })).toBeInTheDocument();
    const added = stored().options.find((o) => o.linkedDecisionId === 'd-pricing-seats' && o.decisionId === 'd-trial');
    expect(added).toBeDefined();
    expect(stored().links).toContainEqual(
      expect.objectContaining({ fromId: 'd-pricing-seats', toId: 'd-trial', kind: 'builds-on', origin: 'user' }),
    );
  });

  it('F-04: a new decision records who makes the call, who to consult and tags, with AI tags kept apart', async () => {
    const ai = fakeAi({ suggestTags: { tags: ['trials', 'notifications'] } });
    const { user } = renderApp('/decisions/new', signedInState(), { ai });
    await user.type(screen.getByLabelText('Decision question'), 'Should trials send a weekly digest email?');
    await user.selectOptions(screen.getByLabelText('Who makes the call'), 'tm-theo');
    await user.click(screen.getByRole('checkbox', { name: 'Ines Moreau' }));
    await user.type(screen.getByLabelText('Tags'), 'growth{Enter}');
    await user.click(screen.getByRole('button', { name: /Suggest tags/ }));
    expect(await screen.findByRole('button', { name: 'Keep tag trials' }, WAIT)).toBeInTheDocument();
    expect(ai.run).toHaveBeenCalledWith('suggestTags', expect.objectContaining({ question: 'Should trials send a weekly digest email?', current: ['growth'] }));
    await user.click(screen.getByRole('button', { name: 'Keep tag trials' }));
    await user.click(screen.getByRole('button', { name: 'Remove tag notifications' }));
    await user.click(screen.getByRole('button', { name: 'Gather evidence' }));

    const created = stored().decisions.find((d) => d.question === 'Should trials send a weekly digest email?')!;
    expect(created.ownerId).toBe('tm-theo');
    expect(created.stakeholderIds).toEqual(['tm-ines']);
    expect(created.tags).toEqual([
      { label: 'growth', origin: 'user' },
      { label: 'trials', origin: 'user' },
    ]);
    expect(await screen.findByRole('heading', { level: 1, name: created.question })).toBeInTheDocument();
  });

  it('F-04: when tags can’t be suggested, it says why and the PM keeps typing their own', async () => {
    const { user } = renderApp('/decisions/new', signedInState(), { ai: fakeAi({ suggestTags: 'budget_reached' }) });
    await user.type(screen.getByLabelText('Decision question'), 'Ship SSO?');
    await user.click(screen.getByRole('button', { name: /Suggest tags/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Rooted has used today’s AI budget');
    await user.type(screen.getByLabelText('Tags'), 'security{Enter}');
    expect(screen.getByRole('button', { name: /Remove tag security/ })).toBeInTheDocument();
  });
});
