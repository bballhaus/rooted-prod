// End-to-end walk through the MVP prototype: sign in, choose data access,
// frame a decision, review the brief, weigh options, log, then visit
// settings and help. Every step uses the real pages and fake data.
import { screen, within } from '@testing-library/react';
import { seedState } from '../data/fixtures';
import { STORAGE_KEY } from '../store/store';
import type { AppState } from '../types';
import { renderApp } from './render';

const SLOW = { timeout: 5000 };

function saved(): AppState {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as AppState;
}

beforeEach(() => localStorage.clear());

it('F-01–F-28: walks sign in → onboarding → frame → brief → options → log → record → settings and help', async () => {
  const { user } = renderApp('/', seedState());

  // F-01, F-21: signed out, so the app sends us to the mocked sign-in.
  await user.click(await screen.findByRole('button', { name: /continue with google/i }));
  const consent = await screen.findByRole('dialog');
  expect(within(consent).getByText(/prototype/i)).toBeInTheDocument();
  await user.click(within(consent).getByRole('button', { name: 'Allow' }));

  // F-02, F-03: choose what Rooted can see.
  expect(await screen.findByRole('heading', { level: 1, name: /choose what rooted can see/i })).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: /continue to rooted/i }));

  // F-17: the history list shows the seeded decisions.
  expect(await screen.findByText(/checklist or a guided tour/i)).toBeInTheDocument();
  await user.click(screen.getAllByRole('link', { name: /new decision/i })[0]);

  // F-04, F-05: frame a new decision.
  await user.type(
    await screen.findByLabelText(/decision question/i),
    'Should we extend the free trial from 14 to 21 days or keep it at 14?',
  );
  await user.type(screen.getByLabelText(/^notes/i), 'Trial-to-paid dipped to 11% in September.');
  await user.click(screen.getByRole('button', { name: /gather evidence/i }));

  // F-06–F-09: the brief gathers context from allowed sources only.
  await screen.findByRole('button', { name: /looks right, show options/i }, SLOW);
  const decision = saved().decisions.find((d) => d.question.startsWith('Should we extend the free trial'));
  expect(decision).toBeDefined();
  await screen.findAllByRole('button', { name: /report wrong answer/i }, SLOW);
  const items = saved().contextItems.filter((c) => c.decisionId === decision!.id);
  expect(items.length).toBeGreaterThan(0);
  expect(items.some((c) => ['#sales', '#leadership', '#random'].includes(c.sourceLabel))).toBe(false);
  expect(saved().gaps.filter((g) => g.decisionId === decision!.id).length).toBeGreaterThanOrEqual(2);
  await user.click(screen.getByRole('button', { name: /looks right, show options/i }));

  // F-10, F-11: options appear; the PM chooses a branch.
  const choose = await screen.findAllByRole('button', { name: /choose this branch/i }, SLOW);
  expect(choose.length).toBeGreaterThanOrEqual(2);
  await user.click(choose[0]);
  expect(screen.getByRole('button', { name: /chosen branch/i })).toHaveAttribute('aria-pressed', 'true');
  await user.click(screen.getByRole('button', { name: /^log decision$/i }));

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

  // F-22–F-28: settings and help are reachable from the nav.
  const nav = screen.getByRole('navigation', { name: 'Main' });
  await user.click(within(nav).getByRole('link', { name: 'Settings' }));
  expect(await screen.findByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument();
  await user.click(within(nav).getByRole('link', { name: 'Help' }));
  expect(await screen.findByRole('heading', { level: 1, name: 'Help' })).toBeInTheDocument();
}, 20000);
