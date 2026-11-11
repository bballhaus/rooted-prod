import { act, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { seedState } from '../../data/fixtures';
import { STORAGE_KEY } from '../../store/store';
import { fakeAuth, identityFor } from '../../test/fakeAuth';
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

  it('F-20: request beta access checks the work email and confirms without storing it', async () => {
    const { user } = renderApp('/signin', { ...seedState(), user: null });
    await user.click(screen.getByRole('tab', { name: 'Request access' }));
    await user.type(screen.getByLabelText('Work email'), 'not-an-email');
    await user.click(screen.getByRole('button', { name: 'Request access' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/work email/i);
    await user.clear(screen.getByLabelText('Work email'));
    await user.type(screen.getByLabelText('Work email'), 'sam@startup.example');
    await user.click(screen.getByRole('button', { name: 'Request access' }));
    expect(screen.getByRole('status')).toHaveTextContent(/on the list/);
    expect(localStorage.getItem(STORAGE_KEY) ?? '').not.toContain('sam@startup.example');
    await user.click(screen.getByRole('button', { name: 'Back to sign in' }));
    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeInTheDocument();
  });

  it('F-01: a signed-in user visiting /signin goes to /', () => {
    renderApp('/signin');
    expect(screen.queryByRole('button', { name: 'Continue with Google' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Decisions' })).toBeInTheDocument();
  });

  it('F-01: onboarding shows the signed-in role and team', () => {
    renderApp('/onboarding');
    expect(screen.getByText(/Signed in as Product manager, Growth/)).toBeInTheDocument();
  });

  it.each([
    ['google', 'Continue with Google'],
    ['slack', 'Continue with Slack'],
  ] as const)('F-21: %s starts that provider’s real sign-in, and coming back signed in opens onboarding', async (provider, label) => {
    const auth = fakeAuth(null);
    const { user } = renderApp('/signin', { ...seedState(), user: null }, { auth });
    await user.click(screen.getByRole('button', { name: label }));
    expect(auth.signInWith).toHaveBeenCalledWith(provider, expect.stringMatching(/\/signin$/));
    await act(async () => auth.emit({ authId: 'auth-sam', email: 'sam@startup.example', name: 'Sam Rivera', provider }));
    expect(screen.getByRole('heading', { name: 'Choose what Rooted can see' })).toBeInTheDocument();
    expect(stored().user).toMatchObject({ authId: 'auth-sam', name: 'Sam Rivera', signInProvider: provider });
  });

  it('F-21: when a provider can’t start, it says so and the buttons work again', async () => {
    const auth = fakeAuth(null, { signInWith: vi.fn(async () => ({ ok: false as const, error: 'provider_unavailable' as const })) });
    const { user } = renderApp('/signin', { ...seedState(), user: null }, { auth });
    await user.click(screen.getByRole('button', { name: 'Continue with Slack' }));
    expect(screen.getByRole('alert')).toHaveTextContent('That sign-in option isn’t available right now');
    expect(screen.getByRole('button', { name: 'Continue with Slack' })).toBeEnabled();
    expect(stored().user).toBeNull();
  });

  it('F-01: the email link checks the address, sends the link and can send it again', async () => {
    const auth = fakeAuth(null);
    const { user } = renderApp('/signin', { ...seedState(), user: null }, { auth });
    await user.type(screen.getByLabelText('Work email'), 'sam@startup');
    await user.click(screen.getByRole('button', { name: 'Email me a sign-in link' }));
    expect(screen.getByRole('alert')).toHaveTextContent('That email address doesn’t look right');
    expect(auth.sendMagicLink).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText('Work email'), '.example');
    await user.click(screen.getByRole('button', { name: 'Email me a sign-in link' }));
    expect(auth.sendMagicLink).toHaveBeenCalledWith('sam@startup.example', expect.stringMatching(/\/signin$/));
    expect(screen.getByRole('status')).toHaveTextContent('We sent a sign-in link to sam@startup.example');
    await user.click(screen.getByRole('button', { name: 'Send it again' }));
    expect(auth.sendMagicLink).toHaveBeenCalledTimes(2);
    await user.click(screen.getByRole('button', { name: 'Use a different email' }));
    expect(screen.getByLabelText('Work email')).toBeInTheDocument();
  });

  it('F-01: too many sign-in emails says to wait, and nothing is marked sent', async () => {
    const auth = fakeAuth(null, { sendMagicLink: vi.fn(async () => ({ ok: false as const, error: 'rate_limited' as const })) });
    const { user } = renderApp('/signin', { ...seedState(), user: null }, { auth });
    await user.type(screen.getByLabelText('Work email'), 'sam@startup.example');
    await user.click(screen.getByRole('button', { name: 'Email me a sign-in link' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Wait a few minutes');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it.each([
    ['?error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired', 'expired or was already used'],
    ['#error=access_denied&error_description=The+user+denied+the+request', 'Sign-in was cancelled'],
    ['?error=server_error&error_description=Unable+to+exchange+external+code', 'Something went wrong signing you in'],
  ])('F-01: coming back with an error in the URL (%s) explains it', (query, message) => {
    renderApp(`/signin${query}`, { ...seedState(), user: null }, { auth: fakeAuth(null) });
    expect(screen.getByRole('alert')).toHaveTextContent(message);
  });

  it('F-01: without sign-in settings it says so, and nobody stays signed in from before', () => {
    renderApp('/', signedInState(), { auth: null });
    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Sign-in isn’t set up');
    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Email me a sign-in link' })).toBeDisabled();
  });

  it('F-01: signing out ends the real session', async () => {
    const auth = fakeAuth(identityFor(signedInState().user));
    const { user } = renderApp('/', signedInState(), { auth });
    await user.click(screen.getByRole('button', { name: 'Your account' }));
    await user.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(auth.signOut).toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(stored().user).toBeNull();
  });

  it('F-01: when the session ends elsewhere (expired, or signed out in another tab), the app goes to sign in', async () => {
    const auth = fakeAuth(identityFor(signedInState().user));
    renderApp('/', signedInState(), { auth });
    expect(screen.getByRole('heading', { level: 1, name: 'Decisions' })).toBeInTheDocument();
    await act(async () => auth.emit(null));
    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
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
