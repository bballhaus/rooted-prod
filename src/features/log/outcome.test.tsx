import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderApp, signedInState } from '../../test/render';

const section = () => screen.getByRole('region', { name: 'Outcome' });

describe('Outcome (F-16)', () => {
  it('a recorded outcome is shown with its metrics and can be edited', () => {
    renderApp('/decisions/d-activation-metric', signedInState());
    expect(within(section()).getByText(/The board adopted it/)).toBeInTheDocument();
    expect(within(section()).getByText('Metrics: Activation 31% (Aug) → 38% (Sep)')).toBeInTheDocument();
    expect(within(section()).getByRole('button', { name: 'Edit outcome' })).toBeInTheDocument();
  });

  it('a decided decision without an outcome offers a form that needs a result, then records it', async () => {
    const { user } = renderApp('/decisions/d-pricing-seats', signedInState());
    await user.click(within(section()).getByRole('button', { name: 'Log the outcome now' }));

    // Saving with nothing picked shows an alert and records nothing.
    await user.click(within(section()).getByRole('button', { name: 'Save outcome' }));
    expect(within(section()).getByRole('alert')).toBeInTheDocument();

    await user.click(within(section()).getByRole('radio', { name: 'Worked' }));
    await user.type(within(section()).getByLabelText('What happened'), 'Two stalled rollouts reopened.');
    await user.type(within(section()).getByLabelText('Metrics (optional)'), 'NRR +4 pts');
    await user.click(within(section()).getByRole('button', { name: 'Save outcome' }));

    expect(within(section()).getByText('Two stalled rollouts reopened.')).toBeInTheDocument();
    expect(within(section()).getByText('Metrics: NRR +4 pts')).toBeInTheDocument();
    expect(within(section()).getByRole('button', { name: 'Edit outcome' })).toBeInTheDocument();
  });
});
