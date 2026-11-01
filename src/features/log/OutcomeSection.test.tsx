import { screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STORAGE_KEY } from '../../store/store';
import { renderApp } from '../../test/render';
import type { AppState } from '../../types';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-31T12:00:00'));
});
afterEach(() => vi.useRealTimers());

const stored = () => JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as AppState;
const section = () => screen.getByRole('region', { name: 'Outcome' });

describe('Outcome', () => {
  it('F-16: past the review date, the record asks what happened and saves the result and metrics', async () => {
    const { user } = renderApp('/decisions/d-onboarding-checklist');
    expect(within(section()).getByText(/review date \(Oct 15, 2026\) has passed/i)).toBeInTheDocument();
    await user.click(within(section()).getByRole('button', { name: 'Save outcome' }));
    expect(within(section()).getByRole('alert')).toHaveTextContent('Pick how it turned out.');

    await user.click(within(section()).getByRole('radio', { name: 'Worked' }));
    await user.type(within(section()).getByLabelText('What happened'), 'Activation rose and held.');
    await user.type(within(section()).getByLabelText('Metrics (optional)'), 'Activation 31% → 38%');
    await user.click(within(section()).getByRole('button', { name: 'Save outcome' }));

    expect(within(section()).getByText('Activation rose and held.')).toBeInTheDocument();
    expect(stored().outcomes.find((o) => o.decisionId === 'd-onboarding-checklist')).toMatchObject({
      result: 'worked',
      summary: 'Activation rose and held.',
      metrics: 'Activation 31% → 38%',
    });
    // Once logged, it's no longer due: the inbox badge drops.
    expect(screen.getByRole('button', { name: 'Inbox, 1 due' })).toBeInTheDocument();
  });

  it('F-16: before the review date it says when Rooted will ask, and can be logged early', async () => {
    const { user } = renderApp('/decisions/d-pricing-seats');
    expect(within(section()).getByText(/Rooted will ask on Nov 20, 2026/)).toBeInTheDocument();
    await user.click(within(section()).getByRole('button', { name: 'Log the outcome now' }));
    expect(within(section()).getByRole('radio', { name: 'Too early to tell' })).toBeInTheDocument();
  });

  it('F-16: an unsaved outcome draft does not follow you to another record', async () => {
    const { user } = renderApp('/decisions/d-onboarding-checklist');
    await user.click(within(section()).getByRole('radio', { name: 'Worked' }));
    await user.type(within(section()).getByLabelText('What happened'), 'Draft for checklist');
    const connected = screen.getByRole('region', { name: 'Connected decisions' });
    await user.click(within(connected).getByRole('link', { name: 'Which activation metric should Growth report on?' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Which activation metric should Growth report on?' })).toBeInTheDocument();
    expect(within(section()).queryByLabelText('What happened')).not.toBeInTheDocument();
    expect(within(section()).getByText(/The board adopted it/)).toBeInTheDocument();
  });

  it('the record shows who decided, tags and connected decisions', () => {
    renderApp('/decisions/d-onboarding-checklist');
    expect(screen.getByText('Jordan Lee, Product manager')).toBeInTheDocument();
    const connected = screen.getByRole('region', { name: 'Connected decisions' });
    expect(within(connected).getByRole('link', { name: 'Which activation metric should Growth report on?' })).toBeInTheDocument();
    expect(within(connected).getByRole('link', { name: 'Should the checklist copy be task-based or benefit-based?' })).toBeInTheDocument();
  });
});
