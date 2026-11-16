import { screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { demoState } from '../../data/demoFixtures';
import { isMine } from '../../store/dashboard';
import { patternDecisions } from '../../store/patterns';
import { STORAGE_KEY } from '../../store/store';
import { fakeAi } from '../../test/fakeAi';
import { renderApp, signedInState } from '../../test/render';
import type { AppState } from '../../types';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-13T12:00:00'));
});
afterEach(() => vi.useRealTimers());

const stored = () => JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as AppState;
const demo = () => demoState('2026-11-13');
const tile = (label: string) => screen.getByText(label, { selector: '.patterns-tile-label' }).parentElement!;
const rooted = () => within(screen.getByRole('region', { name: /What Rooted sees/ }));

describe('Patterns and trends (F-R3-05)', () => {
  it('F-R3-05: is one click from the header on every page', async () => {
    const { user } = renderApp('/', demo());
    const nav = within(screen.getByRole('navigation', { name: 'Main' }));
    await user.click(nav.getByRole('link', { name: 'Patterns' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Patterns and trends' })).toBeInTheDocument();
    expect(nav.getByRole('link', { name: 'Patterns' })).toHaveAttribute('aria-current', 'page');
  });

  it('F-R3-05: shows the numbers from the PM’s own decisions, without calling Rooted', () => {
    const ai = fakeAi();
    renderApp('/patterns', demo(), { ai });
    const numbers = within(screen.getByRole('region', { name: 'By the numbers' }));
    expect(tile('Decisions')).toHaveTextContent('Decisions13');
    expect(tile('Outcomes logged')).toHaveTextContent('Outcomes logged6 of 6');
    expect(numbers.getByRole('table', { name: /Decisions per month/ })).toBeInTheDocument();
    expect(within(numbers.getByRole('region', { name: 'By goal' })).getByRole('rowheader', { name: 'Expansion' })).toBeInTheDocument();
    expect(ai.run).not.toHaveBeenCalled();
  });

  it('F-R3-05: "Just mine" narrows the numbers to the PM’s own decisions', async () => {
    const state = demo();
    const mine = patternDecisions(state, (d) => isMine(d, state)).length;
    expect(mine).toBeLessThan(13);
    const { user } = renderApp('/patterns', state);
    expect(tile('Decisions')).toHaveTextContent('Decisions13');
    await user.click(screen.getByRole('button', { name: 'Just mine' }));
    expect(tile('Decisions')).toHaveTextContent(`Decisions${mine}`);
  });

  it('F-R3-05: Rooted’s patterns and predictions are marked ✦, cite real decisions and link to them on the map', async () => {
    const ai = fakeAi();
    const { user } = renderApp('/patterns', demo(), { ai });
    await user.click(rooted().getByRole('button', { name: 'Look for patterns' }));
    expect(await rooted().findByText('Pricing calls keep coming back to seats.')).toBeInTheDocument();
    expect(rooted().getByText('✦ Pattern')).toBeInTheDocument();
    expect(rooted().getByText('✦ Prediction')).toBeInTheDocument();
    expect(rooted().getByText(/Accounts hitting the cap/)).toBeInTheDocument();
    const sent = ai.run.mock.calls[0][1];
    const firstId = sent.decisions[0].id;
    const link = rooted().getAllByRole('link').find((a) => a.getAttribute('href') === `/?focus=${firstId}`);
    expect(link).toBeTruthy();
    expect(stored().insights).toHaveLength(2);
    expect(rooted().getByRole('button', { name: 'Look again' })).toBeInTheDocument();
  });

  it('F-08: an insight can be edited, and says it was', async () => {
    const { user } = renderApp('/patterns', demo());
    await user.click(rooted().getByRole('button', { name: 'Look for patterns' }));
    const card = (await rooted().findByText('Pricing calls keep coming back to seats.')).closest('li')!;
    await user.click(within(card).getByRole('button', { name: 'Edit' }));
    const field = within(card).getByLabelText('Insight');
    await user.clear(field);
    await user.type(field, 'Seat pricing keeps coming up.');
    await user.click(within(card).getByRole('button', { name: 'Save' }));
    expect(within(card).getByText('Seat pricing keeps coming up.')).toBeInTheDocument();
    expect(within(card).getByText(/edited by you/)).toBeInTheDocument();
    expect(stored().insights[0]).toMatchObject({ title: 'Seat pricing keeps coming up.', userEdited: true });
  });

  it('F-28: an insight can be dismissed or reported as wrong', async () => {
    const { user } = renderApp('/patterns', demo());
    await user.click(rooted().getByRole('button', { name: 'Look for patterns' }));
    const card = (await rooted().findByText('A seat-cap decision is likely next.')).closest('li')!;
    await user.click(within(card).getByRole('button', { name: 'Report wrong answer' }));
    await user.type(screen.getByLabelText('What did Rooted get wrong?'), 'We already decided the cap');
    await user.click(screen.getByRole('button', { name: 'Send report' }));
    expect(stored().reports[0]).toMatchObject({ surface: 'insight', excerpt: 'A seat-cap decision is likely next.' });
    await user.click(within(card).getByRole('button', { name: 'Dismiss' }));
    expect(rooted().queryByText('A seat-cap decision is likely next.')).not.toBeInTheDocument();
    expect(stored().insights.find((i) => i.kind === 'prediction')?.dismissed).toBe(true);
  });

  it('F-08: looking again keeps the insights the PM edited and replaces the rest', async () => {
    const { user } = renderApp('/patterns', demo());
    await user.click(rooted().getByRole('button', { name: 'Look for patterns' }));
    const card = (await rooted().findByText('Pricing calls keep coming back to seats.')).closest('li')!;
    await user.click(within(card).getByRole('button', { name: 'Edit' }));
    await user.clear(within(card).getByLabelText('Insight'));
    await user.type(within(card).getByLabelText('Insight'), 'Mine now.');
    await user.click(within(card).getByRole('button', { name: 'Save' }));
    await user.click(rooted().getByRole('button', { name: 'Look again' }));
    await vi.waitFor(() => expect(stored().insights).toHaveLength(3));
    expect(stored().insights[0]).toMatchObject({ title: 'Mine now.', userEdited: true });
  });

  it('F-23, F-01: an answer that arrives after the workspace changed is dropped, not saved into the new one', async () => {
    let answer!: (v: unknown) => void;
    const ai = fakeAi({ findPatterns: () => new Promise((r) => (answer = r)) });
    const { user } = renderApp('/patterns', demo(), { ai });
    await user.click(rooted().getByRole('button', { name: 'Look for patterns' }));
    // Leave the demo while Rooted is still reading: the PM's own (empty) workspace comes back.
    await user.click(screen.getByRole('button', { name: 'Your account' }));
    await user.click(screen.getByRole('button', { name: 'Leave demo' }));
    const sent = ai.run.mock.calls[0][1];
    answer({ insights: [{ kind: 'pattern', title: 'From the demo', detail: '', decisionIds: [sent.decisions[0].id, sent.decisions[1].id], confidence: 'low', watchFor: '' }] });
    await vi.waitFor(() => expect(stored().demo).toBe(false));
    await new Promise((r) => setTimeout(r, 0));
    expect(stored().insights).toEqual([]);
  });

  it('F-R3-05: when Rooted can’t answer, it says why and offers a retry, with no made-up insights', async () => {
    const { user } = renderApp('/patterns', demo(), { ai: fakeAi({ findPatterns: 'provider_busy' }) });
    await user.click(rooted().getByRole('button', { name: 'Look for patterns' }));
    expect(await rooted().findByRole('alert')).toHaveTextContent('The AI is busy right now');
    expect(rooted().getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    expect(stored().insights).toEqual([]);
  });

  it('F-R3-05: with fewer than three logged decisions, Rooted doesn’t look yet and says why', () => {
    const state = signedInState();
    const few = { ...state, decisions: state.decisions.map((d, i) => (i < 2 ? d : { ...d, status: 'options' as const })) };
    renderApp('/patterns', few);
    expect(rooted().getByRole('button', { name: 'Look for patterns' })).toBeDisabled();
    expect(rooted().getByText(/needs at least 3 logged decisions/)).toBeInTheDocument();
  });

  it('with no decisions, offers to frame one or explore the demo', async () => {
    const { user } = renderApp('/patterns', signedInState({ decisions: [], options: [], contextItems: [], links: [] }));
    expect(screen.getByRole('link', { name: 'Frame a decision' })).toHaveAttribute('href', '/decisions/new');
    await user.click(screen.getByRole('button', { name: 'Explore the demo' }));
    expect(stored().demo).toBe(true);
    expect(screen.getByRole('region', { name: 'By the numbers' })).toBeInTheDocument();
  });
});
