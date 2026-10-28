import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { seedState } from '../../data/fixtures';
import { STORAGE_KEY } from '../../store/store';
import { renderApp, signedInState } from '../../test/render';
import type { AppState } from '../../types';

// The store persists every change, so the saved copy is the store's state.
function stored(): AppState {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as AppState;
}

function sourceCard(name: string) {
  return screen.getByRole('region', { name });
}

describe('Sign in', () => {
  it('F-01: an unauthenticated visit to / redirects to sign in', () => {
    renderApp('/', { ...seedState(), user: null });
    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeInTheDocument();
  });

  it('F-01: a signed-in user visiting /signin goes to /', () => {
    renderApp('/signin');
    expect(screen.queryByRole('button', { name: 'Continue with Google' })).not.toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument();
  });

  it('F-01: onboarding shows the signed-in role and team', () => {
    renderApp('/onboarding');
    expect(screen.getByText(/Signed in as Product manager, Growth/)).toBeInTheDocument();
  });

  it.each([
    ['google', 'Continue with Google'],
    ['slack', 'Continue with Slack'],
  ] as const)('F-21: %s mock consent signs in with that provider and opens onboarding', async (provider, label) => {
    const { user } = renderApp('/signin', { ...seedState(), user: null });
    await user.click(screen.getByRole('button', { name: label }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/Prototype: no real sign-in happens/)).toBeInTheDocument();
    expect(within(dialog).getByText(/jordan@fernwave\.example/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Allow' }));
    expect(screen.getByRole('heading', { name: 'Choose what Rooted can see' })).toBeInTheDocument();
    expect(stored().user?.signInProvider).toBe(provider);
    expect(stored().user?.name).toBe('Jordan Lee');
  });

  it('F-21: cancel closes the mock consent without signing in', async () => {
    const { user } = renderApp('/signin', { ...seedState(), user: null });
    await user.click(screen.getByRole('button', { name: 'Continue with Slack' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(stored().user).toBeNull();
  });
});

describe('Data access', () => {
  it('F-03: connecting Drive through the mock shows the connected state and enables folders', async () => {
    const { user } = renderApp('/onboarding');
    const drive = sourceCard('Google Drive');
    expect(within(drive).getByText(/Not connected/)).toBeInTheDocument();
    expect(within(drive).getByRole('checkbox', { name: /PRDs/ })).toBeDisabled();
    expect(within(drive).queryByText(/0 members/)).not.toBeInTheDocument();

    await user.click(within(drive).getByRole('button', { name: /Connect/ }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/Prototype: no real connection happens/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Allow' }));

    expect(within(drive).getByText(/Connected on/)).toBeInTheDocument();
    expect(within(drive).getByRole('checkbox', { name: /PRDs/ })).toBeEnabled();
    expect(within(drive).getByRole('status')).toHaveTextContent('Rooted can read 2 of 3 Drive folders.');
    const saved = stored().sources.find((s) => s.id === 'src-drive');
    expect(saved?.connected).toBe(true);
    expect(saved?.connectedAt).toBeTruthy();
  });

  it('F-03: Slack shows its connected state and selected channels', () => {
    renderApp('/onboarding');
    const slack = sourceCard('Fernwave Slack');
    expect(within(slack).getByText(/Connected on Oct 1, 2026/)).toBeInTheDocument();
    expect(within(slack).getByRole('checkbox', { name: /#product/ })).toBeChecked();
    expect(within(slack).getByRole('checkbox', { name: /#sales/ })).not.toBeChecked();
    expect(within(slack).getByText('24 members')).toBeInTheDocument();
  });

  it('F-02: toggling a channel updates the store and the summary', async () => {
    const { user } = renderApp('/onboarding');
    const slack = sourceCard('Fernwave Slack');
    const status = within(slack).getByRole('status');
    expect(status).toHaveTextContent('Rooted can read 4 of 7 Slack channels.');

    await user.click(within(slack).getByRole('checkbox', { name: /#sales/ }));
    expect(status).toHaveTextContent('Rooted can read 5 of 7 Slack channels.');
    expect(stored().sources[0].channels.find((c) => c.id === 'ch-sales')?.allowed).toBe(true);

    await user.click(within(slack).getByRole('checkbox', { name: /#product/ }));
    expect(status).toHaveTextContent('Rooted can read 4 of 7 Slack channels.');
    expect(stored().sources[0].channels.find((c) => c.id === 'ch-product')?.allowed).toBe(false);
  });

  it('F-02: allow all and allow none set every channel', async () => {
    const { user } = renderApp('/onboarding');
    const slack = sourceCard('Fernwave Slack');
    const status = within(slack).getByRole('status');

    await user.click(within(slack).getByRole('button', { name: /Allow all/ }));
    expect(status).toHaveTextContent('Rooted can read 7 of 7 Slack channels.');
    expect(stored().sources[0].channels.every((c) => c.allowed)).toBe(true);

    await user.click(within(slack).getByRole('button', { name: /Allow none/ }));
    expect(status).toHaveTextContent('Rooted can read 0 of 7 Slack channels.');
    expect(stored().sources[0].channels.some((c) => c.allowed)).toBe(false);
  });

  it('F-02: channel controls are disabled, with an explanation, when the source is disconnected', async () => {
    const { user } = renderApp('/onboarding');
    const slack = sourceCard('Fernwave Slack');
    await user.click(within(slack).getByRole('button', { name: /Disconnect/ }));

    for (const box of within(slack).getAllByRole('checkbox')) expect(box).toBeDisabled();
    expect(within(slack).getByRole('button', { name: /Allow all/ })).toBeDisabled();
    expect(within(slack).getByText('Connect Fernwave Slack to choose channels.')).toBeInTheDocument();
    expect(within(slack).getByRole('status')).toHaveTextContent('Fernwave Slack is not connected.');
  });

  it('F-02: notes that private channels and DMs are never read', () => {
    renderApp('/onboarding');
    expect(screen.getByText(/Private channels and direct messages are never read/)).toBeInTheDocument();
  });

  it('F-02: continue goes to the decisions home', async () => {
    const { user } = renderApp('/onboarding', signedInState());
    await user.click(screen.getByRole('button', { name: 'Continue to Rooted' }));
    expect(screen.queryByRole('heading', { name: 'Choose what Rooted can see' })).not.toBeInTheDocument();
  });
});
