import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderApp, signedInState } from '../../test/render';

// A seed decided decision with its outcome stripped, so the record page shows
// the "record the outcome" form rather than a recorded result.
function stateWithoutOutcome() {
  const s = signedInState();
  s.decisions = s.decisions.map((d) => (d.id === 'd-pricing-seats' ? { ...d, outcome: undefined } : d));
  return s;
}

describe('Outcome (F-16)', () => {
  it('a recorded outcome is shown with its metrics and can be edited', () => {
    renderApp('/decisions/d-onboarding-checklist', signedInState());
    const section = screen.getByRole('heading', { name: 'Outcome' }).closest('section') as HTMLElement;
    expect(within(section).getByText(/activation climbed/i)).toBeInTheDocument();
    expect(within(section).getByText('Activation 31% → 38%')).toBeInTheDocument();
    expect(within(section).getByRole('button', { name: 'Edit outcome' })).toBeInTheDocument();
  });

  it('a decided decision without an outcome offers a form that needs a result, then records it', async () => {
    const { user } = renderApp('/decisions/d-pricing-seats', stateWithoutOutcome());
    const section = screen.getByRole('heading', { name: 'Outcome' }).closest('section') as HTMLElement;

    // Saving with nothing written shows an alert and records nothing.
    await user.click(within(section).getByRole('button', { name: 'Save outcome' }));
    expect(within(section).getByRole('alert')).toHaveTextContent(/say what happened/i);

    await user.type(within(section).getByLabelText('What happened?'), 'Two stalled rollouts reopened.');
    await user.type(within(section).getByLabelText(/Metrics that moved/), 'NRR +4 pts');
    await user.click(within(section).getByRole('button', { name: 'Save outcome' }));

    const after = screen.getByRole('heading', { name: 'Outcome' }).closest('section') as HTMLElement;
    expect(within(after).getByText('Two stalled rollouts reopened.')).toBeInTheDocument();
    expect(within(after).getByText('NRR +4 pts')).toBeInTheDocument();
    expect(within(after).getByRole('button', { name: 'Edit outcome' })).toBeInTheDocument();
  });
});
