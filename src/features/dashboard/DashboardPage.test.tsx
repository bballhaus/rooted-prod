import { cleanup, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { demoState } from '../../data/demoFixtures';
import { STORAGE_KEY } from '../../store/store';
import { fakeAi } from '../../test/fakeAi';
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

// Filters open on demand; open them when a test needs those controls.
// Needs you is open by default on a wide screen (0019).
const openFilters = (user: ReturnType<typeof renderApp>['user']) =>
  user.click(screen.getByRole('button', { name: /^Filters/ }));
const rail = () => screen.getByRole('complementary', { name: 'Needs you' });

describe('Home dashboard', () => {
  it('F-17: shows everyone’s decisions, grouped by tag, with who decided and what they chose', async () => {
    const { user } = await openList();
    await openFilters(user);
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
    await openFilters(user);
    await user.selectOptions(screen.getByLabelText('Who decided'), 'Rafael Ortiz');
    expect(rows().map((r) => r.textContent)).toEqual([
      expect.stringContaining('Offer an annual discount'),
      expect.stringContaining('one bet for Q4'),
    ]);
    await user.selectOptions(screen.getByLabelText('Who decided'), 'me');
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
    await openFilters(user);
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

  it('F-28: suggested tags and suggested decisions can be reported as wrong', async () => {
    const { user } = await openList();
    await user.click(screen.getByRole('button', { name: /checklist or a guided tour/ }));
    const panel = screen.getByRole('complementary', { name: /checklist or a guided tour/ });
    const tags = within(panel).getByRole('region', { name: 'Tags' });
    await user.click(within(tags).getByRole('button', { name: 'Report wrong answer' }));
    await user.type(screen.getByLabelText('What did Rooted get wrong?'), 'Not a support decision');
    await user.click(screen.getByRole('button', { name: 'Send report' }));
    expect(stored().reports[0]).toMatchObject({ surface: 'tag', decisionId: 'd-onboarding-checklist' });
    expect(within(rail()).getAllByRole('button', { name: 'Report wrong answer' }).length).toBe(3);
    expect(within(rail()).queryByText('Sample')).not.toBeInTheDocument();
  });

  it('F-R2, F-19: Rooted can be asked to spot decisions in Slack and to find connections, as suggestions', async () => {
    const ai = fakeAi();
    const { user } = renderApp('/', signedInState(), { ai });
    await user.click(within(rail()).getByRole('button', { name: 'Check Slack for decisions' }));
    expect(await within(rail()).findByText(/Rooted spotted 1 decision to consider/)).toBeInTheDocument();
    expect(within(rail()).getByText('Should we change how we onboard new teams?')).toBeInTheDocument();
    expect(stored().suggestions.find((x) => x.question === 'Should we change how we onboard new teams?')?.status).toBe('new');
    // The demo's sample channels are sent; only allowed ones.
    const sent = ai.run.mock.calls.find(([task]) => task === 'spotDecisions')![1];
    expect(sent.messages.every((m: { source: string }) => !['#sales', '#leadership', '#random'].includes(m.source))).toBe(true);

    await user.click(within(rail()).getByRole('button', { name: 'Find connections' }));
    expect(await within(rail()).findByText(/Rooted found \d+ possible connection/)).toBeInTheDocument();
    const added = stored().links.filter((l) => l.id.startsWith('l-ai-'));
    expect(added.length).toBeGreaterThan(0);
    expect(added.every((l) => l.origin === 'ai' && l.status === 'suggested')).toBe(true);
  });

  it('F-R2: when Rooted can’t check Slack, it says why', async () => {
    const { user } = renderApp('/', signedInState(), { ai: fakeAi({ spotDecisions: 'slack_token_revoked' }) });
    await user.click(within(rail()).getByRole('button', { name: 'Check Slack for decisions' }));
    expect(await within(rail()).findByRole('alert')).toHaveTextContent('Connect Slack again');
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
  it('F-16: the rail lists outcomes due, each with its next step, and the inbox badge counts them', () => {
    renderApp('/');
    expect(screen.getByRole('button', { name: 'Inbox, 2 due' })).toBeInTheDocument();
    const due = within(screen.getByRole('region', { name: /^Due/ }));
    expect(due.getByText('Should onboarding use a checklist or a guided tour?')).toBeInTheDocument();
    expect(due.getByText(/Outcome overdue since Oct 15, 2026/)).toBeInTheDocument();
    expect(due.getAllByRole('link', { name: 'Log outcome' })[0]).toHaveAttribute('href', expect.stringMatching(/#outcome$/));
    expect(within(rail()).getByText(/^2 due · /)).toBeInTheDocument();
  });

  it('F-19: the rail lists the PM’s decisions in progress with their stage, open questions and deadline', () => {
    const state = demoState();
    renderApp('/', state);
    const decide = within(screen.getByRole('region', { name: 'Decisions to make' }));
    const sso = decide.getByRole('link', { name: /Build SSO and SAML/ });
    expect(sso).toHaveAttribute('href', '/decisions/d-sso-enterprise/work');
    expect(sso).toHaveTextContent('Gathering evidence · 2 open questions · decide by');
    expect(decide.getByRole('link', { name: 'New decision' })).toHaveAttribute('href', '/decisions/new');
    expect(within(rail()).getByRole('link', { name: /Patterns and trends/ })).toHaveAttribute('href', '/patterns');
  });

  it('decisions Rooted spotted can be started or dismissed', async () => {
    const { user } = renderApp('/');
    const guest = within(rail()).getByText('Let admins turn off @mention emails for guests?').closest('li')!;
    await user.click(within(guest).getByRole('button', { name: 'Dismiss' }));
    expect(stored().suggestions.find((s) => s.id === 'sg-guest-mentions')?.status).toBe('dismissed');

    const sync = within(rail()).getByText('Move onboarding checklist progress to the server?').closest('li')!;
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

// The canvas work from decision 0010, on the planted demo workspace (0009).
describe('Decision canvas', () => {
  const demo = () => demoState();
  const panelFor = (name: RegExp) => within(screen.getByRole('complementary', { name }));

  it('F-17: opens as a tree, with Tree, Timeline and List always side by side in one switch', async () => {
    const { user } = renderApp('/', demo());
    const views = within(screen.getByRole('group', { name: 'View' }));
    expect(views.getByRole('button', { name: /Tree/ })).toHaveAttribute('aria-pressed', 'true');
    expect(views.getByRole('button', { name: /Timeline/ })).toHaveAttribute('aria-pressed', 'false');
    // Grouping only applies to the timeline and the list.
    expect(screen.queryByLabelText('Group by')).not.toBeInTheDocument();
    await user.click(views.getByRole('button', { name: /List/ }));
    // Switching to the list keeps every view in reach.
    expect(views.getByRole('button', { name: /Tree/ })).toHaveAttribute('aria-pressed', 'false');
    expect(views.getByRole('button', { name: /Timeline/ })).toBeInTheDocument();
    expect(views.getByRole('button', { name: /List/ })).toHaveAttribute('aria-pressed', 'true');
  });

  it('F-17: the tree names each tree of linked decisions and sets unlinked ones apart', () => {
    renderApp('/', demo());
    const labels = [...document.querySelectorAll('.map-group')].map((l) => l.textContent);
    expect(labels.length).toBeGreaterThan(1);
    expect(labels.some((l) => /^Enterprise · Expansion\d+$/.test(l ?? ''))).toBe(true);
  });

  it('F-17: switching to the timeline brings in grouping by lane', async () => {
    const { user } = renderApp('/', demo());
    await user.click(screen.getByRole('button', { name: /Timeline/ }));
    expect(screen.getByLabelText('Group by')).toHaveValue('thread');
  });

  it('F-17: the map key sets what the colors show and says what each color and line means', () => {
    renderApp('/', demo());
    const key = within(screen.getByRole('region', { name: 'Map key' }));
    expect(key.getByLabelText('Color by')).toHaveValue('status');
    const statuses = within(key.getByRole('list', { name: 'Statuses' }));
    for (const s of ['In progress', 'Decided', 'Outcome due', 'Outcome logged', 'Direction to explore'])
      expect(statuses.getByText(s)).toBeInTheDocument();
    expect(within(key.getByRole('list', { name: 'Lines' })).getByText('Builds on')).toBeInTheDocument();
  });

  it('F-17: the key can be hidden to a single button and brought back', async () => {
    const { user } = renderApp('/', demo());
    await user.click(screen.getByRole('button', { name: 'Hide the key' }));
    expect(screen.queryByRole('region', { name: 'Map key' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Key · Status/ }));
    expect(screen.getByRole('region', { name: 'Map key' })).toBeInTheDocument();
  });

  it('F-17: filters say how many are on and how many decisions show, and clear in one step', async () => {
    const { user } = renderApp('/', demo());
    await openFilters(user);
    expect(screen.getByText('17 of 17 shown')).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Status'), 'open');
    expect(screen.getByRole('button', { name: 'Filters, 1 on' })).toBeInTheDocument();
    expect(screen.getByText(/^\d+ of 17 shown$/)).not.toHaveTextContent('17 of 17');
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(screen.getByLabelText('Status')).toHaveValue('all');
    expect(screen.getByRole('button', { name: 'Filters' })).toBeInTheDocument();
  });

  it('F-18: picking a decided decision shows its reasoning, outcome and a link to the record', async () => {
    const { user } = renderApp('/?focus=d-activation-metric', demo());
    const panel = panelFor(/How should we define activation/);
    expect(panel.getByText(/strongest predictor/)).toBeInTheDocument();
    expect(panel.getByText(/north-star activation metric/)).toBeInTheDocument();
    expect(panel.getByRole('link', { name: 'Open the full record' })).toHaveAttribute('href', '/decisions/d-activation-metric');
    await user.click(screen.getByRole('button', { name: 'Close details' }));
    expect(screen.queryByRole('complementary', { name: /How should we define activation/ })).not.toBeInTheDocument();
  });

  it('a planted direction is labelled as one and can be explored', () => {
    renderApp('/?focus=d-future-usage-pricing', demo());
    const panel = panelFor(/usage-based pricing/);
    expect(panel.getByText('Direction to explore')).toBeInTheDocument();
    expect(panel.getByRole('link', { name: 'Explore this direction' })).toHaveAttribute(
      'href',
      '/decisions/d-future-usage-pricing/work',
    );
  });

  it('builds-on lets you walk back to the decisions a call grew from', async () => {
    const { user } = renderApp('/?focus=d-self-serve-expansion', demo());
    await user.click(panelFor(/drive expansion revenue/).getByRole('link', { name: /Charge per seat or per workspace/ }));
    expect(screen.getByRole('complementary', { name: /Charge per seat or per workspace/ })).toBeInTheDocument();
  });

  it('F-04: the PM can rename their own open decision from the details, or cancel with Escape', async () => {
    const { user } = renderApp('/?focus=d-self-serve-expansion', demo());
    await user.click(panelFor(/drive expansion revenue/).getByRole('button', { name: 'Rename decision' }));
    await user.type(screen.getByLabelText('Rename decision'), ' Draft{Escape}');
    expect(stored().decisions.find((d) => d.id === 'd-self-serve-expansion')?.question).toBe(
      'How do we drive expansion revenue inside existing accounts?',
    );
    await user.click(panelFor(/drive expansion revenue/).getByRole('button', { name: 'Rename decision' }));
    const input = screen.getByLabelText('Rename decision');
    await user.clear(input);
    await user.type(input, 'Grow revenue inside existing accounts?{Enter}');
    expect(screen.getByRole('complementary', { name: /Grow revenue inside existing accounts/ })).toBeInTheDocument();
    expect(stored().decisions.find((d) => d.id === 'd-self-serve-expansion')?.question).toBe(
      'Grow revenue inside existing accounts?',
    );
  });

  it('a logged record and a teammate’s decision have no rename', () => {
    renderApp('/?focus=d-onboarding-checklist', demo());
    expect(panelFor(/checklist or a guided tour/).queryByRole('button', { name: 'Rename decision' })).not.toBeInTheDocument();
    cleanup();
    renderApp('/?focus=o-api-v2', demo());
    expect(panelFor(/Ship API v2/).queryByRole('button', { name: 'Rename decision' })).not.toBeInTheDocument();
  });

  it('planted directions are not listed as the PM’s decisions in progress', () => {
    renderApp('/', demo());
    expect(within(rail()).getByRole('link', { name: /drive expansion revenue/ })).toBeInTheDocument();
    expect(within(rail()).queryByRole('link', { name: /usage-based pricing/ })).not.toBeInTheDocument();
  });

  it('F-19: picking a decision lights up everything it built on and led to, and fades the rest', () => {
    renderApp('/?focus=d-weekly-digest', demo());
    const card = (id: string) => document.querySelector(`.react-flow__node[data-id="${id}"] .map-node`)!;
    expect(card('d-weekly-digest')).toHaveClass('map-node-traced');
    expect(card('d-mobile-push')).toHaveClass('map-node-traced');
    expect(card('d-activation-metric')).toHaveClass('map-node-faded');
    expect(card('d-activation-metric')).not.toHaveClass('map-node-traced');
  });

  it('coloring by goal or by person shows what each color means', async () => {
    const { user } = renderApp('/', demo());
    await user.selectOptions(screen.getByLabelText('Color by'), 'goal');
    expect(within(screen.getByRole('list', { name: 'Goals' })).getByText('Activation')).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Color by'), 'owner');
    expect(within(screen.getByRole('list', { name: 'People' })).getByText('Dev Patel')).toBeInTheDocument();
  });

  it('the demo labels itself as sample data, and "Just me" hides teammates’ decisions', async () => {
    const { user } = await openListWith(demo());
    expect(screen.getByText(/Demo/).closest('.demo-badge')).toHaveTextContent('Demo · sample data');
    expect(screen.getByRole('button', { name: /Ship API v2 with breaking changes/ })).toBeInTheDocument();
    await openFilters(user);
    await user.selectOptions(screen.getByLabelText('Who decided'), 'me');
    expect(screen.queryByRole('button', { name: /Ship API v2 with breaking changes/ })).not.toBeInTheDocument();
  });

  it('the Needs you panel is open by default on a wide screen, and can be hidden then shown again', async () => {
    const { user } = renderApp('/', demo());
    expect(rail()).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Hide the Needs you panel' }));
    expect(screen.queryByRole('complementary', { name: 'Needs you' })).not.toBeInTheDocument();
    expect(localStorage.getItem('rooted-needs-open')).toBe('off');
    await user.click(screen.getByRole('button', { name: /Show the Needs you panel/ }));
    expect(rail()).toBeInTheDocument();
  });

  it('with no decisions, offers to frame the first one or load the demo', async () => {
    const { user } = renderApp('/', signedInState({ decisions: [], options: [], contextItems: [], links: [] }));
    expect(screen.getByRole('link', { name: 'Frame your first decision' })).toHaveAttribute('href', '/decisions/new');
    await user.click(screen.getByRole('button', { name: 'Explore the demo' }));
    expect(stored().demo).toBe(true);
    expect(screen.getByText(/· sample data/)).toBeInTheDocument();
  });
});

async function openListWith(state: AppState) {
  const utils = renderApp('/', state);
  await utils.user.click(screen.getByRole('button', { name: 'List' }));
  return utils;
}

describe('Profile menu: theme and demo', () => {
  afterEach(() => {
    document.documentElement.dataset.theme = 'light';
  });

  it('dark mode toggles from the profile menu and is remembered', async () => {
    document.documentElement.dataset.theme = 'light';
    const { user } = renderApp('/');
    await user.click(screen.getByRole('button', { name: 'Your account' }));
    const toggle = screen.getByRole('button', { name: /Dark mode/ });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await user.click(toggle);
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem('rooted-theme')).toBe('dark');
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
  });

  it('the demo can be entered and left from the profile menu', async () => {
    const { user } = renderApp('/');
    await user.click(screen.getByRole('button', { name: 'Your account' }));
    await user.click(screen.getByRole('button', { name: 'Explore the demo' }));
    expect(stored().demo).toBe(true);
    expect(screen.getByText(/· sample data/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Your account' }));
    await user.click(screen.getByRole('button', { name: 'Leave demo' }));
    expect(stored().demo).toBe(false);
    expect(screen.queryByText(/· sample data/)).not.toBeInTheDocument();
  });
});
