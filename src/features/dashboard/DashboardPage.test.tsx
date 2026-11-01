import { screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STORAGE_KEY } from '../../store/store';
import { renderApp, signedInState } from '../../test/render';
import type { AppState } from '../../types';

// Fixtures are dated around Oct 31, 2026; pin the clock so "due" is stable.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-31T12:00:00'));
});
afterEach(() => vi.useRealTimers());

const stored = () => JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as AppState;
const WAIT = { timeout: 3000 };

// The map is a canvas; the list view shows the same decisions as plain rows.
async function openList() {
  const utils = renderApp('/');
  await utils.user.click(screen.getByRole('button', { name: 'List' }));
  return utils;
}
const rows = () => screen.getAllByRole('button').filter((b) => b.classList.contains('dash-row'));

describe('Home dashboard', () => {
  it('F-17: shows everyone’s decisions, grouped by tag, with who decided and what they chose', async () => {
    const { user } = await openList();
    await user.selectOptions(screen.getByLabelText('Group by'), 'tag');
    expect(screen.getByRole('heading', { level: 1, name: 'Decisions' })).toBeInTheDocument();
    expect(rows()).toHaveLength(signedInState().decisions.length);
    const pricing = screen.getByRole('region', { name: 'pricing' });
    const seats = within(pricing).getByRole('button', { name: /Charge per seat or per workspace/ });
    expect(seats).toHaveTextContent('Chose: Per workspace with seat cap');
    expect(seats).toHaveTextContent('Jordan Lee');
  });

  it('F-17: filters by who decided, by status and by tag', async () => {
    const { user } = await openList();
    await user.selectOptions(screen.getByLabelText('Who'), 'Rafael Ortiz');
    expect(rows().map((r) => r.textContent)).toEqual([
      expect.stringContaining('Offer an annual discount'),
      expect.stringContaining('one bet for Q4'),
    ]);
    await user.selectOptions(screen.getByLabelText('Who'), 'me');
    await user.selectOptions(screen.getByLabelText('Status'), 'outcome-due');
    expect(rows().map((r) => r.textContent)).toEqual([
      expect.stringContaining('daily or weekly'),
      expect.stringContaining('checklist or a guided tour'),
    ]);
    await user.selectOptions(screen.getByLabelText('Status'), 'all');
    await user.selectOptions(screen.getByLabelText('Tag'), 'notifications');
    expect(rows().every((r) => /push|digest/i.test(r.textContent ?? ''))).toBe(true);
  });

  it('F-17: lanes group by thread by default, so linked decisions sit together', async () => {
    await openList();
    const roadmap = screen.getByRole('region', { name: '#roadmap' });
    expect(within(roadmap).getByRole('button', { name: /checklist or a guided tour/ })).toBeInTheDocument();
    expect(within(roadmap).getByRole('button', { name: /SSO in the Team plan/ })).toBeInTheDocument();
    const loose = screen.getByRole('region', { name: 'Not linked yet' });
    expect(within(loose).getByRole('button', { name: /support hours/ })).toBeInTheDocument();
  });

  it('F-17: lanes can group by team and by who decided', async () => {
    const { user } = await openList();
    await user.selectOptions(screen.getByLabelText('Group by'), 'team');
    expect(screen.getByRole('region', { name: 'Platform' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Support' })).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Group by'), 'owner');
    expect(screen.getByRole('region', { name: 'Maya Torres' })).toBeInTheDocument();
  });

  it('F-17: typing in the header search filters the decisions', async () => {
    const { user } = await openList();
    await user.type(screen.getByRole('searchbox', { name: 'Search or ask about decisions' }), 'seat');
    expect(rows().length).toBeLessThan(signedInState().decisions.length);
    expect(rows().some((r) => /per seat/i.test(r.textContent ?? ''))).toBe(true);
    await user.clear(screen.getByRole('searchbox'));
    await user.type(screen.getByRole('searchbox'), 'zebra');
    expect(screen.getByText('No decisions match.')).toBeInTheDocument();
  });

  it('F-17: with no decisions, prompts the PM to frame the first one', () => {
    renderApp('/', signedInState({ decisions: [], options: [], contextItems: [], links: [] }));
    expect(screen.getByRole('heading', { name: 'Start with one decision.' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Frame your first decision' })).toHaveAttribute('href', '/decisions/new');
  });

  it('F-18, F-19: picking a decision shows what was decided, why, who, what it was based on and what was passed on', async () => {
    const { user } = await openList();
    await user.click(screen.getByRole('button', { name: /checklist or a guided tour/ }));
    const panel = screen.getByRole('complementary', { name: /checklist or a guided tour/ });
    expect(within(panel).getByText(/Decided by/).parentElement).toHaveTextContent('Decided by Jordan Lee');
    expect(within(panel).getByText(/Consulted: Maya Torres, Priya Raman/)).toBeInTheDocument();
    expect(within(panel).getByText(/Chose “Setup checklist”/)).toBeInTheDocument();
    expect(within(panel).getByText(/Interviews showed admins come back/)).toBeInTheDocument();
    expect(within(panel).getByText(/Third admin this week/)).toBeInTheDocument();
    expect(within(panel).getByText('Guided product tour')).toHaveClass('pruned-label');
    expect(within(panel).getByRole('link', { name: 'Which activation metric should Growth report on?' })).toBeInTheDocument();
    expect(within(panel).getByRole('link', { name: 'Log outcome' })).toHaveAttribute(
      'href',
      '/decisions/d-onboarding-checklist#outcome',
    );
    expect(within(panel).getByRole('link', { name: 'Open the full record' })).toHaveAttribute(
      'href',
      '/decisions/d-onboarding-checklist',
    );
  });

  it('F-19: a link Rooted found can be connected or dismissed, and reported', async () => {
    const { user } = await openList();
    await user.click(screen.getByRole('button', { name: /checklist or a guided tour/ }));
    const panel = screen.getByRole('complementary', { name: /checklist or a guided tour/ });
    expect(within(panel).getByText(/Rooted thinks these are connected/)).toBeInTheDocument();
    expect(within(panel).getAllByRole('button', { name: 'Report wrong answer' }).length).toBeGreaterThan(0);
    await user.click(within(panel).getByRole('button', { name: 'Connect' }));
    expect(stored().links.find((l) => l.id === 'l-help-center--onboarding-checklist')?.status).toBe('accepted');
  });

  it('AI tags are marked as suggestions and can be kept or removed', async () => {
    const { user } = await openList();
    await user.click(screen.getByRole('button', { name: /checklist or a guided tour/ }));
    const panel = screen.getByRole('complementary', { name: /checklist or a guided tour/ });
    expect(within(panel).getByText('Suggested by Rooted:', { exact: false })).toBeInTheDocument();
    await user.click(within(panel).getByRole('button', { name: 'Keep tag support' }));
    expect(stored().decisions.find((d) => d.id === 'd-onboarding-checklist')?.tags).toContainEqual({
      label: 'support',
      origin: 'user',
    });
  });

  it('F-28: suggested tags and suggested decisions can be reported as wrong, and seeded suggestions say they are samples', async () => {
    const { user } = await openList();
    await user.click(screen.getByRole('button', { name: /checklist or a guided tour/ }));
    const panel = screen.getByRole('complementary', { name: /checklist or a guided tour/ });
    const tags = within(panel).getByRole('region', { name: 'Tags' });
    await user.click(within(tags).getByRole('button', { name: 'Report wrong answer' }));
    await user.type(screen.getByLabelText('What did Rooted get wrong?'), 'Not a support decision');
    await user.click(screen.getByRole('button', { name: 'Send report' }));
    expect(stored().reports[0]).toMatchObject({ surface: 'tag', decisionId: 'd-onboarding-checklist' });
    const rail = screen.getByRole('complementary', { name: 'Needs you' });
    expect(within(rail).getAllByText('Sample')).toHaveLength(3);
  });

  it('F-04: "Add a follow-up decision" starts one that builds on the picked decision', async () => {
    const { user } = await openList();
    await user.click(screen.getByRole('button', { name: /Charge per seat or per workspace/ }));
    await user.click(screen.getByRole('button', { name: 'Add a follow-up decision' }));
    expect(screen.getByLabelText('Builds on a past decision (optional)')).toHaveValue('d-pricing-seats');
    await user.type(screen.getByLabelText('Decision question'), 'Raise the seat cap from 25 to 40?');
    await user.click(screen.getByRole('button', { name: 'Gather evidence' }));
    const created = stored().decisions.find((d) => d.question === 'Raise the seat cap from 25 to 40?')!;
    expect(stored().links).toContainEqual(
      expect.objectContaining({ fromId: 'd-pricing-seats', toId: created.id, origin: 'user', status: 'accepted' }),
    );
  });
});

describe('Needs you and the inbox', () => {
  it('F-16: the rail lists outcomes due and the inbox badge counts them', () => {
    renderApp('/');
    const rail = screen.getByRole('complementary', { name: 'Needs you' });
    expect(within(rail).getByText('Should onboarding use a checklist or a guided tour?')).toBeInTheDocument();
    expect(within(rail).getByText(/Outcome overdue since Oct 15, 2026/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Inbox, 2 due' })).toBeInTheDocument();
  });

  it('decisions Rooted spotted can be started or dismissed', async () => {
    const { user } = renderApp('/');
    const rail = screen.getByRole('complementary', { name: 'Needs you' });
    const guest = within(rail).getByText('Let admins turn off @mention emails for guests?').closest('li')!;
    await user.click(within(guest).getByRole('button', { name: 'Dismiss' }));
    expect(stored().suggestions.find((s) => s.id === 'sg-guest-mentions')?.status).toBe('dismissed');

    const sync = within(rail).getByText('Move onboarding checklist progress to the server?').closest('li')!;
    await user.click(within(sync).getByRole('button', { name: 'Start this decision' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Move onboarding checklist progress to the server?' }, WAIT),
    ).toBeInTheDocument();
    const started = stored().suggestions.find((s) => s.id === 'sg-checklist-sync')!;
    expect(started.status).toBe('started');
    expect(stored().decisions.find((d) => d.id === started.decisionId)?.notes).toMatch(/resets on a new device/);
  });

  it('the inbox opens from the bell and lists everything that needs the PM', async () => {
    const { user } = renderApp('/');
    await user.click(screen.getByRole('button', { name: 'Inbox, 2 due' }));
    const inbox = screen.getByRole('heading', { name: 'Inbox' }).parentElement!;
    expect(within(inbox).getAllByText('Outcome due')).toHaveLength(2);
    expect(within(inbox).getAllByText(/Rooted suggests/).length).toBe(3);
    expect(within(inbox).getAllByText(/Suggested link/).length).toBe(3);
  });
});

describe('Header and footer', () => {
  it('settings and sign out live in the profile menu; help lives in the footer', async () => {
    const { user } = renderApp('/');
    expect(screen.queryByRole('link', { name: 'Settings' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Your account' }));
    const account = screen.getByRole('navigation', { name: 'Account' });
    expect(within(account).getByRole('link', { name: 'Profile' })).toHaveAttribute('href', '/settings#settings-profile');
    expect(within(account).getByRole('link', { name: 'All settings' })).toHaveAttribute('href', '/settings');
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
    const footer = screen.getByRole('navigation', { name: 'Help and support' });
    expect(within(footer).getByRole('link', { name: 'Help & FAQ' })).toHaveAttribute('href', '/help');
    expect(within(footer).getByRole('link', { name: 'Report a problem' })).toBeInTheDocument();
  });

  it('F-01: sign out from the profile menu returns to sign in', async () => {
    const { user } = renderApp('/');
    await user.click(screen.getByRole('button', { name: 'Your account' }));
    await user.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(await screen.findByRole('button', { name: /continue with google/i })).toBeInTheDocument();
  });
});
