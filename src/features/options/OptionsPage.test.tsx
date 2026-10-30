import { act, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { generateOptions } from '../../agent/options';
import { renderApp, signedInState } from '../../test/render';
import type { AppState, ContextItem, Decision } from '../../types';

const trial: Decision = {
  id: 'd-trial',
  question: 'Should the trial use a usage limit or a 14-day time limit?',
  notes: 'Trial-to-paid conversion slipped from 14% to 11% this quarter.',
  links: [],
  constraints: ['No new eng headcount'],
  status: 'brief',
  createdAt: '2026-10-20T17:00:00.000Z',
};

function ctx(id: string, patch: Partial<ContextItem>): ContextItem {
  return {
    id,
    decisionId: 'd-trial',
    origin: 'slack',
    sourceLabel: '#growth',
    author: 'Sam (Growth eng)',
    date: '2026-10-14',
    snippet: '',
    group: 'Usage',
    flaggedInaccurate: false,
    userEdited: false,
    removed: false,
    ...patch,
  };
}

const items: ContextItem[] = [
  ctx('c-t1', {
    snippet: 'Most trials that convert hit the usage limit in week one.',
  }),
  ctx('c-t2', {
    sourceLabel: '#customer-feedback',
    snippet: 'Admins say 14 days is too short to get legal sign-off.',
  }),
  ctx('c-t3', {
    sourceLabel: '#sales',
    snippet: 'Removed thread about an old discount.',
    removed: true,
  }),
];

function state(patch: Partial<AppState> = {}): AppState {
  const base = signedInState();
  return {
    ...base,
    decisions: [trial, ...base.decisions],
    contextItems: [...base.contextItems, ...items],
    ...patch,
  };
}

function stateWithOptions(): AppState {
  const s = state();
  return {
    ...s,
    options: [...s.options, ...generateOptions(trial, s.contextItems, [])],
  };
}

const cards = () => screen.getAllByRole('listitem').filter((li) => li.classList.contains('options-card'));
const card = (label: string) => cards().find((c) => within(c).queryByRole('heading', { name: label }))!;

describe('OptionsPage', () => {
  it('F-10: generates options with a narrated loading state when the decision has none', async () => {
    renderApp('/decisions/d-trial/options', state());
    expect(screen.getByRole('status')).toHaveTextContent(/reading your evidence brief/i);
    expect(await screen.findByRole('heading', { name: 'Usage limit' }, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '14-day time limit' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Gather more evidence first' })).toBeInTheDocument();
  });

  it('F-11: cards show pros, cons, a rough score and evidence chips with the snippet on focus', async () => {
    const { user } = renderApp('/decisions/d-trial/options', stateWithOptions());
    const usage = card('Usage limit');
    expect(within(usage).getByRole('heading', { name: 'Pros' })).toBeInTheDocument();
    expect(within(usage).getByRole('heading', { name: 'Cons' })).toBeInTheDocument();
    expect(within(usage).getByText('Rough score')).toBeInTheDocument();
    expect(screen.getAllByText(/rough guide; you make the call/i).length).toBeGreaterThan(0);
    const chip = within(usage).getByRole('button', { name: '#growth' });
    expect(chip).toHaveAccessibleDescription(/hit the usage limit in week one/);
    const tip = document.getElementById(chip.getAttribute('aria-describedby')!)!;
    expect(tip).toHaveAttribute('role', 'tooltip');
    expect(tip).not.toHaveClass('options-tip-open');
    await user.hover(chip);
    expect(tip).toHaveClass('options-tip-open');
    await user.unhover(chip);
    expect(tip).not.toHaveClass('options-tip-open');
    act(() => chip.focus());
    expect(tip).toHaveClass('options-tip-open');
    await user.keyboard('{Escape}');
    expect(tip).not.toHaveClass('options-tip-open');
    // Removed context is never cited.
    expect(screen.queryByRole('button', { name: '#sales' })).not.toBeInTheDocument();
    expect(
      within(card('14-day time limit')).getByRole('button', {
        name: '#customer-feedback',
      }),
    ).toBeInTheDocument();
  });

  it('F-11: edits an option inline', async () => {
    const { user } = renderApp('/decisions/d-trial/options', stateWithOptions());
    await user.click(
      within(card('Usage limit')).getByRole('button', {
        name: 'Edit Usage limit',
      }),
    );
    const label = screen.getByLabelText('Option');
    await user.clear(label);
    await user.type(label, 'Cap at 500 synced records');
    const pros = screen.getByLabelText('Pros');
    await user.clear(pros);
    await user.type(pros, 'Matches how converting trials behave{enter}Simple to explain');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    const edited = card('Cap at 500 synced records');
    expect(within(edited).getByText('Simple to explain')).toBeInTheDocument();
  });

  it('F-11: adds your own option', async () => {
    const { user } = renderApp('/decisions/d-trial/options', stateWithOptions());
    await user.click(screen.getByRole('button', { name: 'Add your own option' }));
    await user.click(screen.getByRole('button', { name: 'Add option' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/give the option a name/i);
    await user.type(screen.getByLabelText('Option'), 'Reverse trial: start on Team, drop to Starter');
    await user.click(screen.getByRole('button', { name: 'Add option' }));
    const mine = card('Reverse trial: start on Team, drop to Starter');
    expect(within(mine).getByText('Your option')).toBeInTheDocument();
    expect(within(mine).getByText(/not scored/i)).toBeInTheDocument();
  });

  it('F-11: pruning requires a reason, keeps the option with its reason, and can be restored', async () => {
    const { user } = renderApp('/decisions/d-trial/options', stateWithOptions());
    await user.click(
      within(card('14-day time limit')).getByRole('button', {
        name: 'Prune 14-day time limit',
      }),
    );
    await user.click(screen.getByRole('button', { name: 'Prune branch' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/add a reason/i);
    await user.type(screen.getByLabelText(/why are you pruning/i), 'Legal sign-off takes longer than 14 days.');
    await user.click(screen.getByRole('button', { name: 'Prune branch' }));
    const pruned = card('14-day time limit');
    expect(within(pruned).getByRole('heading', { name: '14-day time limit' }).firstChild).toHaveClass('pruned-label');
    expect(within(pruned).getByText(/legal sign-off takes longer than 14 days/i)).toBeInTheDocument();
    expect(within(pruned).queryByRole('button', { name: /choose this branch/i })).not.toBeInTheDocument();
    await user.click(within(pruned).getByRole('button', { name: 'Restore 14-day time limit' }));
    expect(
      within(card('14-day time limit')).getByRole('heading', {
        name: '14-day time limit',
      }).firstChild,
    ).not.toHaveClass('pruned-label');
    expect(
      within(card('14-day time limit')).getByRole('button', {
        name: /choose this branch/i,
      }),
    ).toBeInTheDocument();
  });

  it('F-11: choosing a branch sets aria-pressed and only one card is chosen (wine)', async () => {
    const { user } = renderApp('/decisions/d-trial/options', stateWithOptions());
    const first = within(card('Usage limit')).getByRole('button', {
      name: /choose this branch/i,
    });
    await user.click(first);
    expect(first).toHaveAttribute('aria-pressed', 'true');
    expect(card('Usage limit')).toHaveClass('card-rec');
    const second = within(card('14-day time limit')).getByRole('button', {
      name: /choose this branch/i,
    });
    await user.click(second);
    expect(second).toHaveAttribute('aria-pressed', 'true');
    expect(
      within(card('Usage limit')).getByRole('button', {
        name: /choose this branch/i,
      }),
    ).toHaveAttribute('aria-pressed', 'false');
    expect(cards().filter((c) => c.classList.contains('card-rec'))).toHaveLength(1);
    expect(document.querySelectorAll('.options-card .pill-rec')).toHaveLength(1);
  });

  it('F-11: the highest rough score gets a neutral label, never wine', () => {
    const s = stateWithOptions();
    renderApp('/decisions/d-trial/options', s);
    const label = screen.getByText('Highest rough score');
    expect(label).not.toHaveClass('pill-rec');
    expect(label.closest('.options-card')).not.toHaveClass('card-rec');
    const top = Math.max(...s.options.filter((o) => o.decisionId === 'd-trial').map((o) => o.score));
    expect(within(label.closest('.options-card') as HTMLElement).getByText(String(top))).toBeInTheDocument();
  });

  it('F-11: every agent option carries a report wrong answer action', () => {
    renderApp('/decisions/d-trial/options', stateWithOptions());
    for (const c of cards()) {
      expect(within(c).getByRole('button', { name: 'Report wrong answer' })).toBeInTheDocument();
    }
  });

  it('F-11: regenerate asks for confirmation before replacing edits', async () => {
    const { user } = renderApp('/decisions/d-trial/options', stateWithOptions());
    await user.click(screen.getByRole('button', { name: 'Regenerate options' }));
    expect(screen.getByText(/will be replaced/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Keep current options' }));
    expect(screen.getByRole('heading', { name: 'Usage limit' })).toBeInTheDocument();
  });

  it('decided decisions are read-only, show the chosen option as wine and link to the record', () => {
    renderApp('/decisions/d-onboarding-checklist/options');
    expect(screen.queryByRole('button', { name: /choose this branch/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^edit/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^prune/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /add your own option/i })).not.toBeInTheDocument();
    expect(card('Setup checklist')).toHaveClass('card-rec');
    expect(card('Guided product tour')).not.toHaveClass('card-rec');
    expect(within(card('Guided product tour')).getByText(/one-time tour misses them/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View the decision record' })).toHaveAttribute(
      'href',
      '/decisions/d-onboarding-checklist',
    );
  });

  it('shows a message and a link home for an unknown decision', () => {
    renderApp('/decisions/nope/options');
    expect(screen.getByRole('heading', { name: 'Decision not found' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to your decisions' })).toHaveAttribute('href', '/');
  });
});
