import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { STORAGE_KEY } from '../../store/store';
import { renderApp } from '../../test/render';
import type { AppState } from '../../types';

// The store persists every change to localStorage, so tests read it back from there.
function stored(): AppState {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as AppState;
}

describe('Settings', () => {
  it('F-22: edits name, role and team and confirms the save; email is read-only', async () => {
    const { user } = renderApp('/settings');
    expect(screen.getByRole('textbox', { name: 'Email' })).toHaveAttribute('readonly');
    const role = screen.getByLabelText('Role');
    await user.clear(role);
    await user.type(role, 'Senior product manager');
    const team = screen.getByLabelText('Team');
    await user.clear(team);
    await user.type(team, 'Activation');
    await user.click(screen.getByRole('button', { name: 'Save profile' }));
    expect(screen.getAllByRole('status').some((s) => s.textContent === 'Saved')).toBe(true);
    expect(stored().user).toMatchObject({ name: 'Jordan Lee', role: 'Senior product manager', team: 'Activation' });
  });

  it('F-24: shows a read-only plan card with beta status and no pricing', () => {
    renderApp('/settings');
    const plan = screen.getByRole('region', { name: 'Plan' });
    expect(within(plan).getByText('Beta')).toBeInTheDocument();
    expect(within(plan).getByText(/free during the beta/i)).toBeInTheDocument();
    expect(plan.textContent).not.toMatch(/\$/);
    expect(within(plan).queryByRole('button')).toBeNull();
    expect(within(plan).queryByRole('textbox')).toBeNull();
  });

  it('F-25: switching the nudge channel to email updates the store', async () => {
    const { user } = renderApp('/settings');
    expect(screen.getByRole('radio', { name: 'Slack' })).toBeChecked();
    await user.click(screen.getByRole('radio', { name: 'Email' }));
    expect(screen.getByRole('radio', { name: 'Email' })).toBeChecked();
    expect(stored().user?.notificationChannel).toBe('email');
    expect(screen.getByText(/nudges are mocked/i)).toBeInTheDocument();
  });

  it('F-26: choosing a 90-day default review offset updates the store and says it applies to new decisions', async () => {
    const { user } = renderApp('/settings');
    await user.click(screen.getByRole('radio', { name: '90 days' }));
    expect(stored().user?.defaultReviewDays).toBe(90);
    expect(screen.getByText(/applies to new decisions/i)).toBeInTheDocument();
  });

  it('F-23: disconnecting a source asks for confirmation first', async () => {
    const { user } = renderApp('/settings');
    const sources = screen.getByRole('region', { name: 'Sources' });
    expect(within(sources).getByRole('link', { name: 'Manage channels for Fernwave Slack' })).toHaveAttribute(
      'href',
      '/onboarding',
    );
    await user.click(within(sources).getByRole('button', { name: 'Disconnect Fernwave Slack' }));
    const dialog = screen.getByRole('dialog', { name: /disconnect fernwave slack/i });
    // Cancel leaves it connected.
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(stored().sources.find((s) => s.id === 'src-slack')?.connected).toBe(true);

    await user.click(within(sources).getByRole('button', { name: 'Disconnect Fernwave Slack' }));
    await user.click(
      within(screen.getByRole('dialog', { name: /disconnect fernwave slack/i })).getByRole('button', {
        name: 'Disconnect',
      }),
    );
    const slack = stored().sources.find((s) => s.id === 'src-slack');
    expect(slack?.connected).toBe(false);
    expect(slack?.connectedAt).toBeUndefined();
    expect(within(sources).getAllByText('Not connected')).toHaveLength(2);
    expect(within(sources).getByRole('link', { name: 'Connect for Fernwave Slack' })).toHaveAttribute(
      'href',
      '/onboarding',
    );
  });

  it('F-23: delete all data requires typing DELETE, then wipes decisions', async () => {
    const { user } = renderApp('/settings');
    expect(stored().decisions.length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: 'Delete all data' }));
    const dialog = screen.getByRole('dialog', { name: 'Delete all your data?' });
    const confirm = within(dialog).getByRole('button', { name: 'Delete everything' });
    expect(confirm).toBeDisabled();
    await user.type(within(dialog).getByLabelText('Type DELETE to confirm'), 'delete');
    expect(confirm).toBeDisabled();
    await user.clear(within(dialog).getByLabelText('Type DELETE to confirm'));
    await user.type(within(dialog).getByLabelText('Type DELETE to confirm'), 'DELETE');
    expect(confirm).toBeEnabled();
    await user.click(confirm);
    expect(stored().decisions).toEqual([]);
    expect(stored().options).toEqual([]);
    expect(stored().sources.every((s) => !s.connected)).toBe(true);
    expect(screen.getByText(/all your data was deleted/i)).toBeInTheDocument();
  });

  it('F-23: reset sample data asks to confirm and restores the sample decisions', async () => {
    const { user } = renderApp('/settings');
    await user.click(screen.getByRole('button', { name: 'Delete all data' }));
    await user.type(screen.getByLabelText('Type DELETE to confirm'), 'DELETE');
    await user.click(screen.getByRole('button', { name: 'Delete everything' }));
    expect(stored().decisions).toEqual([]);
    await user.click(screen.getByRole('button', { name: 'Reset sample data' }));
    const dialog = screen.getByRole('dialog', { name: 'Reset sample data?' });
    await user.click(within(dialog).getByRole('button', { name: 'Reset sample data' }));
    expect(stored().decisions).toHaveLength(3);
    expect(stored().user?.name).toBe('Jordan Lee');
  });
});
