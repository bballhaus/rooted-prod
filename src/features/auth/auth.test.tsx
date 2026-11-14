import { act, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { emptyWorkspaceState, seedState } from '../../data/fixtures';
import { AiError } from '../../agent/client';
import { fakeAi } from '../../test/fakeAi';
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
    expect(document.activeElement).toHaveTextContent('Check your inbox');
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

  it('F-01: a sign-in link opened in a different browser says to open it where it was asked for', async () => {
    renderApp('/signin?code=one-time-code', { ...seedState(), user: null }, { auth: fakeAuth(null) });
    expect(await screen.findByRole('alert')).toHaveTextContent('Open the sign-in link in the same browser');
  });

  it('F-01: a session that ends while the first check is still loading stays ended', async () => {
    let finishFirstRead: (v: null | ReturnType<typeof identityFor>) => void = () => {};
    const auth = fakeAuth(identityFor(signedInState().user), {
      getIdentity: () => new Promise((resolve) => (finishFirstRead = resolve)),
    });
    renderApp('/', signedInState(), { auth });
    await act(async () => auth.emit(null));
    await act(async () => finishFirstRead(identityFor(signedInState().user)));
    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(stored().user).toBeNull();
  });

  it('F-01: without sign-in settings it says so, and nobody stays signed in from before', () => {
    renderApp('/', signedInState(), { auth: null });
    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.getByText('Sign-in isn’t available right now. Try again later.')).toBeInTheDocument();
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
  it('F-03: in the demo, switching on the sample Drive says it is sample data and enables folders', async () => {
    const { user } = renderApp('/onboarding');
    const drive = sourceCard('Google Drive');
    expect(within(drive).getByText(/Not connected/)).toBeInTheDocument();
    expect(within(drive).getByRole('checkbox', { name: /PRDs/ })).toBeDisabled();
    expect(within(drive).queryByText(/0 members/)).not.toBeInTheDocument();

    await user.click(within(drive).getByRole('button', { name: /Connect/ }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/Demo workspace: sample data/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Allow' }));

    expect(within(drive).getByText(/Connected on/)).toBeInTheDocument();
    expect(within(drive).getByRole('checkbox', { name: /PRDs/ })).toBeEnabled();
    expect(within(drive).getByRole('status')).toHaveTextContent('Rooted can read 2 of 3 Drive folders.');
    const saved = stored().sources.find((s) => s.id === 'src-drive');
    expect(saved?.connected).toBe(true);
    expect(saved?.connectedAt).toBeTruthy();
  });

  it('F-03: a live Slack connects through Slack’s own permission page', async () => {
    const ai = fakeAi();
    const assign = vi.fn();
    Object.defineProperty(window, 'location', { value: { ...window.location, assign }, configurable: true, writable: true });
    const { user } = renderApp('/onboarding', { ...emptyWorkspaceState(), user: signedInState().user }, { ai });
    const slack = sourceCard('Slack');
    expect(within(slack).getByText(/Not connected/)).toBeInTheDocument();
    await user.click(within(slack).getByRole('button', { name: /Connect/ }));
    expect(ai.slackInstallUrl).toHaveBeenCalled();
    await waitFor(() => expect(assign).toHaveBeenCalledWith('https://slack.com/oauth/v2/authorize?state=test'));
    expect(within(sourceCard('Google Drive')).getByText(/Not available yet/)).toBeInTheDocument();
  });

  it('F-02, F-03: back from Slack, its public channels show up unchecked until the PM allows them', async () => {
    const ai = fakeAi();
    ai.slack = { available: true, connected: true, teamName: 'Acme', connectedAt: 1794000000, channels: [{ id: 'C1', name: '#pricing', memberCount: 4 }, { id: 'C2', name: '#eng', memberCount: 9 }] };
    const { user } = renderApp('/onboarding?slack=connected', { ...emptyWorkspaceState(), user: signedInState().user }, { ai });
    expect(await screen.findByText('Slack is connected. Check the channels Rooted may read.')).toBeInTheDocument();
    const slack = await screen.findByRole('region', { name: 'Acme Slack' });
    expect(within(slack).getByRole('checkbox', { name: /#pricing/ })).not.toBeChecked();
    await user.click(within(slack).getByRole('checkbox', { name: /#pricing/ }));
    expect(stored().sources.find((x) => x.id === 'src-slack')?.channels.find((c) => c.id === 'C1')?.allowed).toBe(true);
    // Disconnecting revokes it on the server too.
    await user.click(within(slack).getByRole('button', { name: /Disconnect/ }));
    await waitFor(() => expect(ai.slackDisconnect).toHaveBeenCalled());
    expect(stored().sources.find((x) => x.id === 'src-slack')?.connected).toBe(false);
  });

  it('F-03, 0017: back from Slack, the app finishes the install as the signed-in PM and clears the address', async () => {
    const ai = fakeAi();
    ai.slack = { available: true, connected: true, teamName: 'Acme', channels: [{ id: 'C1', name: '#pricing', memberCount: 4 }] };
    renderApp('/onboarding?slack_code=abc&slack_state=s1', { ...emptyWorkspaceState(), user: signedInState().user }, { ai });
    expect(await screen.findByText('Slack is connected. Check the channels Rooted may read.')).toBeInTheDocument();
    expect(ai.slackComplete).toHaveBeenCalledWith('abc', 's1');
    expect(await screen.findByRole('region', { name: 'Acme Slack' })).toBeInTheDocument();
  });

  it('F-03, 0017: an install started from another Rooted account is refused and says so', async () => {
    const ai = fakeAi();
    ai.slackComplete.mockRejectedValue(new AiError('slack_state_mismatch'));
    renderApp('/onboarding?slack_code=abc&slack_state=theirs', { ...emptyWorkspaceState(), user: signedInState().user }, { ai });
    expect(await screen.findByText(/started from a different Rooted account/)).toBeInTheDocument();
    expect(stored().sources.find((x) => x.id === 'src-slack')?.connected).toBe(false);
  });

  it('F-23: a failed disconnect leaves Slack connected and says why', async () => {
    const ai = fakeAi();
    ai.slack = { available: true, connected: true, teamName: 'Acme', channels: [] };
    ai.slackDisconnect.mockRejectedValue(new AiError('network'));
    const { user } = renderApp('/onboarding', { ...emptyWorkspaceState(), user: signedInState().user }, { ai });
    const slack = await screen.findByRole('region', { name: 'Acme Slack' });
    await user.click(within(slack).getByRole('button', { name: /Disconnect/ }));
    expect(await screen.findByText(/couldn’t reach its AI service/)).toBeInTheDocument();
    expect(stored().sources.find((x) => x.id === 'src-slack')?.connected).toBe(true);
  });

  it.each([
    ['cancelled', 'the permission page was cancelled'],
    ['expired', 'Start it again here'],
    ['error', 'ask a Slack admin'],
  ])('F-03: coming back from Slack with %s explains what happened', (kind, text) => {
    renderApp(`/onboarding?slack=${kind}`, { ...emptyWorkspaceState(), user: signedInState().user });
    expect(screen.getByRole('alert')).toHaveTextContent(text);
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
