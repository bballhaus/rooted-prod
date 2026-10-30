import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { STORAGE_KEY } from '../../store/store';
import { renderApp, signedInState } from '../../test/render';
import type { AppState } from '../../types';
import { FAQ, FAQ_TOPICS } from './faq';

function stored(): AppState {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as AppState;
}

describe('Help', () => {
  it('F-27: shows 12–16 FAQ answers grouped by topic', () => {
    renderApp('/help');
    expect(FAQ.length).toBeGreaterThanOrEqual(12);
    expect(FAQ.length).toBeLessThanOrEqual(16);
    for (const topic of FAQ_TOPICS) {
      expect(screen.getByRole('heading', { name: topic })).toBeInTheDocument();
    }
    expect(screen.getByText('What happens to the options I don’t choose?')).toBeInTheDocument();
  });

  it('F-27: search filters the FAQ and shows an empty state when nothing matches', async () => {
    const { user } = renderApp('/help');
    const search = screen.getByLabelText('Search the FAQ');
    await user.type(search, 'private channels');
    expect(screen.getByText('Which Slack channels does Rooted read?')).toBeInTheDocument();
    expect(screen.queryByText('What does Rooted cost?')).toBeNull();

    await user.clear(search);
    await user.type(search, 'zebra migration');
    expect(screen.getByText(/no answers match/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(screen.getByText('What does Rooted cost?')).toBeInTheDocument();
  });

  it('F-28: a wrong-answer report needs a note, is saved to the store and appears in "Your reports"', async () => {
    const { user } = renderApp('/help');
    const form = screen.getByRole('region', { name: 'Report a wrong answer' });
    await user.click(within(form).getByRole('button', { name: 'Send report' }));
    expect(within(form).getByRole('alert')).toHaveTextContent(/what rooted got wrong/i);
    expect(stored().reports).toEqual([]);

    await user.selectOptions(
      within(form).getByLabelText('Decision (optional)'),
      'Build mobile push notifications this quarter?',
    );
    await user.selectOptions(within(form).getByLabelText('Where was it?'), 'option');
    await user.type(within(form).getByLabelText('What did Rooted get wrong?'), 'Mobile share is 9%, not 19%.');
    await user.click(within(form).getByRole('button', { name: 'Send report' }));

    expect(stored().reports).toHaveLength(1);
    expect(stored().reports[0]).toMatchObject({
      surface: 'option',
      decisionId: 'd-mobile-push',
      note: 'Mobile share is 9%, not 19%.',
    });
    expect(within(form).getByText(/report saved/i)).toBeInTheDocument();
    const list = screen.getByRole('region', { name: 'Your reports' });
    expect(within(list).getByText('Mobile share is 9%, not 19%.')).toBeInTheDocument();
    expect(within(list).getByRole('link', { name: 'Build mobile push notifications this quarter?' })).toBeInTheDocument();
  });

  it('F-28: "Your reports" lists reports made elsewhere with their date and decision', () => {
    const state = signedInState({
      reports: [
        {
          id: 'r-seed',
          surface: 'brief',
          decisionId: 'd-onboarding-checklist',
          excerpt: 'Activation stalled at 13% in August.',
          note: 'It was 31%.',
          createdAt: '2026-10-20T15:00:00.000Z',
        },
      ],
    });
    renderApp('/help', state);
    const list = screen.getByRole('region', { name: 'Your reports' });
    expect(within(list).getByText('It was 31%.')).toBeInTheDocument();
    expect(within(list).getByText('Oct 20, 2026')).toBeInTheDocument();
    expect(within(list).getByText('Should onboarding use a checklist or a guided tour?')).toBeInTheDocument();
  });

  it('F-28: the support form requires a message and confirms nothing was sent', async () => {
    const { user } = renderApp('/help');
    const form = screen.getByRole('region', { name: 'Contact support' });
    await user.click(within(form).getByRole('button', { name: 'Send message' }));
    expect(within(form).getByRole('alert')).toBeInTheDocument();
    await user.selectOptions(within(form).getByLabelText('Topic'), 'Account');
    await user.type(within(form).getByLabelText('Message'), 'How do I export my decision records?');
    await user.click(within(form).getByRole('button', { name: 'Send message' }));
    expect(within(form).getByRole('status')).toHaveTextContent('Prototype: nothing was sent');
    expect(stored().reports).toEqual([]);
  });
});
