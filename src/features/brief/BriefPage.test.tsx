import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom';
import { slackCorpus } from '../../data/slackCorpus';
import { StoreProvider, useDecision } from '../../store/store';
import { renderApp, signedInState } from '../../test/render';
import type { AppState, Decision } from '../../types';
import { BriefPage } from './BriefPage';

const decision: Decision = {
  id: 'd-trial',
  question: 'Should we extend the free trial from 14 to 30 days?',
  notes: 'Trial-to-paid conversion is flat and sales keeps asking for longer trials.',
  links: [],
  constraints: ['Billing changes need two weeks notice'],
  status: 'brief',
  createdAt: '2026-10-27T17:00:00.000Z',
};

function stateWith(patch: Partial<Decision> = {}): AppState {
  const s = signedInState();
  return { ...s, decisions: [{ ...decision, ...patch }, ...s.decisions] };
}

const WAIT = { timeout: 4000 };

async function openGathered(state = stateWith()) {
  const utils = renderApp('/decisions/d-trial/brief', state);
  await screen.findByRole('heading', { name: /^Context/, level: 2 }, WAIT);
  return utils;
}

function firstItem(): HTMLElement {
  return screen.getAllByRole('article')[0];
}

describe('BriefPage', () => {
  it('F-06: shows a gathering state, then items from allowed sources only', async () => {
    renderApp('/decisions/d-trial/brief', stateWith());
    expect(screen.getByRole('status')).toHaveTextContent(/Reading #|Checking past decisions/);
    await screen.findByRole('heading', { name: /^Context/, level: 2 }, WAIT);
    expect(screen.getAllByRole('article').length).toBeGreaterThan(0);
    expect(screen.getByText(/Trial-to-paid is 11.4%/)).toBeInTheDocument();

    const blocked = slackCorpus.filter((m) => ['ch-sales', 'ch-leadership', 'ch-random'].includes(m.channelId));
    for (const m of blocked) expect(screen.queryByText(m.text)).not.toBeInTheDocument();
    expect(screen.queryByText('Google Drive', { selector: '.pill' })).not.toBeInTheDocument();
    // The page says what it read and skipped.
    expect(screen.getByText(/#sales \(not allowed\)/)).toBeInTheDocument();
    expect(screen.getByText(/Google Drive \(not connected\)/)).toBeInTheDocument();
  });

  it('F-07: search and filter chips narrow the list', async () => {
    const { user } = await openGathered();
    const total = screen.getAllByRole('article').length;

    await user.type(screen.getByLabelText('Search the brief'), 'billing');
    const searched = screen.getAllByRole('article');
    expect(searched.length).toBeLessThan(total);
    for (const a of searched) expect(a).toHaveTextContent(/billing/i);
    await user.clear(screen.getByLabelText('Search the brief'));

    const sourceFilters = screen.getByRole('group', { name: 'Filter by source' });
    await user.click(within(sourceFilters).getByRole('button', { name: 'Your notes' }));
    expect(within(sourceFilters).getByRole('button', { name: 'Your notes' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getAllByRole('article')).toHaveLength(1);
    expect(firstItem()).toHaveTextContent('Your framing notes');
    await user.click(within(sourceFilters).getByRole('button', { name: 'All sources' }));

    const themeFilters = screen.getByRole('group', { name: 'Filter by theme' });
    await user.click(within(themeFilters).getByRole('button', { name: 'Trials and conversion' }));
    const themed = screen.getAllByRole('article');
    expect(themed.length).toBeLessThan(total);
    expect(screen.getByRole('heading', { name: 'Trials and conversion', level: 3 })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Your notes', level: 3 })).not.toBeInTheDocument();
  });

  it('F-08: an item can be marked wrong, edited, removed and restored', async () => {
    const { user } = await openGathered();
    const item = firstItem();
    const label = within(item).getByRole('heading').textContent ?? '';

    await user.click(within(item).getByRole('button', { name: 'Mark wrong' }));
    expect(within(firstItem()).getByRole('button', { name: 'Mark wrong' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(firstItem()).getByText('Marked wrong')).toBeInTheDocument();

    await user.click(within(firstItem()).getByRole('button', { name: 'Edit' }));
    const box = within(firstItem()).getByLabelText('Edit this context');
    await user.clear(box);
    await user.type(box, 'Trial-to-paid is 12%, not 11.4%; the dashboard was stale.');
    await user.click(within(firstItem()).getByRole('button', { name: 'Save edit' }));
    expect(within(firstItem()).getByText('Trial-to-paid is 12%, not 11.4%; the dashboard was stale.')).toBeInTheDocument();
    expect(within(firstItem()).getByText('Edited by you')).toBeInTheDocument();

    const before = screen.getAllByRole('article').length;
    await user.click(within(firstItem()).getByRole('button', { name: 'Remove' }));
    expect(screen.getAllByRole('article')).toHaveLength(before - 1);
    expect(screen.getByText('Removed (1)')).toBeInTheDocument();

    await user.click(screen.getByText('Removed (1)'));
    await user.click(screen.getByRole('button', { name: /^Restore/ }));
    expect(screen.getAllByRole('article')).toHaveLength(before);
    expect(screen.queryByText('Removed (1)')).not.toBeInTheDocument();
    expect(screen.getAllByRole('heading', { name: label }).length).toBeGreaterThan(0);
  });

  it('F-08: every item carries a report wrong answer action', async () => {
    await openGathered();
    for (const a of screen.getAllByRole('article')) {
      expect(within(a).getByRole('button', { name: 'Report wrong answer' })).toBeInTheDocument();
    }
  });

  it('F-08: the PM can add their own context', async () => {
    const { user } = await openGathered();
    await user.type(screen.getByLabelText('What should Rooted know?'), 'Finance wants trial changes reviewed before December.');
    await user.type(screen.getByLabelText("Where it's from (optional)"), '1:1 with Rafael');
    await user.click(screen.getByRole('button', { name: 'Add to brief' }));
    expect(screen.getByText('Finance wants trial changes reviewed before December.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '1:1 with Rafael' })).toBeInTheDocument();
  });

  it('F-09: gaps are shown and an answer is saved', async () => {
    const { user } = await openGathered();
    const gaps = screen.getByRole('region', { name: "What Rooted couldn't find" });
    expect(within(gaps).getByText(/#sales isn't in your allowed channels/, { selector: 'p' })).toBeInTheDocument();
    expect(within(gaps).getByText(/Google Drive isn't connected/, { selector: 'p' })).toBeInTheDocument();
    expect(within(gaps).getAllByRole('button', { name: 'Report wrong answer' }).length).toBeGreaterThanOrEqual(2);

    const input = within(gaps).getAllByRole('textbox')[0];
    await user.type(input, 'Aiming for 14% trial-to-paid.');
    await user.click(within(gaps).getAllByRole('button', { name: 'Save answer' })[0]);
    expect(within(gaps).getByText('Aiming for 14% trial-to-paid.')).toBeInTheDocument();
    expect(within(gaps).getByRole('button', { name: /Edit your answer/ })).toBeInTheDocument();
  });

  it('F-06: gather again asks first, then replaces edits', async () => {
    const { user } = await openGathered();
    await user.click(within(firstItem()).getByRole('button', { name: 'Remove' }));
    expect(screen.getByText('Removed (1)')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Gather again' }));
    expect(screen.getByRole('heading', { name: 'Gather context again?' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Replace the brief' }));
    expect(await screen.findByText(/Reading #|Checking past/)).toBeInTheDocument();
    await screen.findByRole('heading', { name: /^Context/, level: 2 }, WAIT);
    expect(screen.queryByText('Removed (1)')).not.toBeInTheDocument();
  });

  it('continues to options and moves the decision forward', async () => {
    const state = stateWith();
    const user = userEvent.setup();
    function OptionsProbe() {
      const d = useDecision(useParams().id);
      return <p>options page, status {d?.status}</p>;
    }
    render(
      <StoreProvider initialState={state}>
        <MemoryRouter initialEntries={['/decisions/d-trial/brief']}>
          <Routes>
            <Route path="/decisions/:id/brief" element={<BriefPage />} />
            <Route path="/decisions/:id/options" element={<OptionsProbe />} />
          </Routes>
        </MemoryRouter>
      </StoreProvider>,
    );
    await screen.findByRole('heading', { name: /^Context/, level: 2 }, WAIT);
    await user.click(screen.getByRole('button', { name: 'Looks right, show options' }));
    expect(screen.getByText('options page, status options')).toBeInTheDocument();
  });

  it('does not move a decided decision backward', async () => {
    const state = signedInState();
    const user = userEvent.setup();
    function OptionsProbe() {
      const d = useDecision(useParams().id);
      return <p>options page, status {d?.status}</p>;
    }
    render(
      <StoreProvider initialState={state}>
        <MemoryRouter initialEntries={['/decisions/d-pricing-seats/brief']}>
          <Routes>
            <Route path="/decisions/:id/brief" element={<BriefPage />} />
            <Route path="/decisions/:id/options" element={<OptionsProbe />} />
          </Routes>
        </MemoryRouter>
      </StoreProvider>,
    );
    await screen.findByRole('heading', { name: /^Context/, level: 2 }, WAIT);
    await user.click(screen.getByRole('button', { name: 'Looks right, show options' }));
    expect(screen.getByText('options page, status decided')).toBeInTheDocument();
  });

  it('shows a helpful message for an unknown decision', () => {
    renderApp('/decisions/nope/brief');
    expect(screen.getByRole('heading', { name: 'Decision not found' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to decisions' })).toHaveAttribute('href', '/');
  });
});
