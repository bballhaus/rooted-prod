// End-to-end walk through the MVP prototype: sign in, choose data access, land
// on the decision map, frame a decision, work it through in the workspace
// (brief, then options), log it, then reach settings from the profile menu and
// help from the footer. Every step uses the real pages and fake data.
import { act, screen, within } from '@testing-library/react';
import { demoUser, seedState } from '../data/fixtures';
import { STORAGE_KEY } from '../store/store';
import type { AppState } from '../types';
import { fakeAuth, identityFor } from './fakeAuth';
import { renderApp } from './render';

const SLOW = { timeout: 5000 };

function saved(): AppState {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as AppState;
}

beforeEach(() => localStorage.clear());

it('F-01–F-28: walks sign in → onboarding → map → frame → brief → options → log → record → settings and help', async () => {
  const auth = fakeAuth(null);
  const { user } = renderApp('/', seedState(), { auth });

  // F-01, F-21: signed out, so the app sends us to sign in. Google's real
  // consent screen happens off-site; here the fake session comes back.
  await user.click(await screen.findByRole('button', { name: /continue with google/i }));
  expect(auth.signInWith).toHaveBeenCalledWith('google', expect.any(String));
  await act(async () => auth.emit({ ...identityFor(demoUser)!, authId: 'auth-jordan' }));

  // F-02, F-03: choose what Rooted can see.
  expect(await screen.findByRole('heading', { level: 1, name: /choose what rooted can see/i })).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: /continue to rooted/i }));

  // F-17: home is the decision map, with "Needs you" open beside it: what's due and what to decide.
  expect(await screen.findByRole('heading', { level: 1, name: 'Decisions' })).toBeInTheDocument();
  const rail = screen.getByRole('complementary', { name: 'Needs you' });
  await user.click(within(rail).getByRole('link', { name: 'New decision' }));

  // F-04, F-05: frame a new decision.
  await user.type(
    await screen.findByLabelText(/decision question/i),
    'Should we extend the free trial from 14 to 21 days or keep it at 14?',
  );
  await user.type(screen.getByLabelText(/^notes/i), 'Trial-to-paid dipped to 11% in September.');
  await user.click(screen.getByRole('button', { name: /gather evidence/i }));

  // F-06–F-09: the workspace gathers context from allowed sources only.
  await screen.findByRole('button', { name: /looks right, show options/i }, SLOW);
  const decision = saved().decisions.find((d) => d.question.startsWith('Should we extend the free trial'));
  expect(decision).toBeDefined();
  expect(decision!.ownerId).toBe('u-1');
  await screen.findAllByRole('button', { name: /report wrong answer/i }, SLOW);
  const items = saved().contextItems.filter((c) => c.decisionId === decision!.id);
  expect(items.length).toBeGreaterThan(0);
  expect(items.some((c) => ['#sales', '#leadership', '#random'].includes(c.sourceLabel))).toBe(false);
  expect(saved().gaps.filter((g) => g.decisionId === decision!.id).length).toBeGreaterThanOrEqual(2);
  await user.click(screen.getByRole('button', { name: /looks right, show options/i }));

  // F-10, F-11: options appear on the same page; the PM chooses a branch.
  const options = screen.getByRole('region', { name: 'Options' });
  const choose = await within(options).findAllByRole('button', { name: /choose this branch/i }, SLOW);
  expect(choose.length).toBeGreaterThanOrEqual(2);
  await user.click(choose[0]);
  expect(within(options).getByRole('button', { name: /chosen branch/i })).toHaveAttribute('aria-pressed', 'true');
  await user.click(within(options).getByRole('button', { name: /^log decision$/i }));

  // F-14, F-15: one-step log with a drafted, editable record.
  const dialog = await screen.findByRole('dialog', { name: /log decision/i });
  await user.click(within(dialog).getByRole('button', { name: /draft the rest/i }));
  const rationale = await within(dialog).findByLabelText(/rationale/i, {}, SLOW);
  expect((rationale as HTMLTextAreaElement).value.length).toBeGreaterThan(0);
  await user.click(within(dialog).getByRole('button', { name: /^log decision$/i }));

  // F-18: the record shows the choice and the options not taken.
  expect(await screen.findByRole('heading', { level: 1, name: /extend the free trial/i })).toBeInTheDocument();
  expect(screen.getByText(/options not taken/i)).toBeInTheDocument();
  const logged = saved().decisions.find((d) => d.id === decision!.id)!;
  expect(logged.status).toBe('decided');
  expect(logged.chosenOptionId).toBeTruthy();
  const others = saved().options.filter((o) => o.decisionId === decision!.id && o.id !== logged.chosenOptionId);
  expect(others.every((o) => o.state === 'pruned')).toBe(true);

  // F-22–F-26: settings live in the profile menu at the top right.
  await user.click(screen.getByRole('button', { name: 'Your account' }));
  await user.click(screen.getByRole('link', { name: 'All settings' }));
  expect(await screen.findByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument();

  // F-27, F-28: help is in the footer.
  const footer = screen.getByRole('navigation', { name: 'Help and support' });
  await user.click(within(footer).getByRole('link', { name: 'Help & FAQ' }));
  expect(await screen.findByRole('heading', { level: 1, name: 'Help' })).toBeInTheDocument();
}, 25000);
