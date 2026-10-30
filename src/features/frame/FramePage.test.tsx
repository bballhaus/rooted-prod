import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { StoreProvider, useStore } from '../../store/store';
import { renderApp, signedInState } from '../../test/render';
import type { AppState, Decision } from '../../types';
import { addDays, FramePage, toIsoDate } from './FramePage';

// Stands in for the brief page so the tests can read where the form went and
// what it saved, without depending on another feature's markup.
function BriefProbe() {
  const { id } = useParams();
  const location = useLocation();
  const { state } = useStore();
  const decision = state.decisions.find((d) => d.id === id);
  return (
    <div>
      <p data-testid="probe-path">{location.pathname}</p>
      <pre data-testid="probe-decision">{JSON.stringify(decision ?? null)}</pre>
    </div>
  );
}

function renderFrame(path: string, state: AppState = signedInState()) {
  const user = userEvent.setup();
  render(
    <StoreProvider initialState={state}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/decisions/new" element={<FramePage />} />
          <Route path="/decisions/:id/frame" element={<FramePage />} />
          <Route path="/decisions/:id/brief" element={<BriefProbe />} />
        </Routes>
      </MemoryRouter>
    </StoreProvider>,
  );
  return { user };
}

async function savedDecision(): Promise<Decision> {
  const pre = await screen.findByTestId('probe-decision');
  return JSON.parse(pre.textContent ?? 'null') as Decision;
}

const framingDecision: Decision = {
  id: 'd-trial-length',
  question: 'Extend the free trial from 14 to 21 days?',
  notes: 'Trial-to-paid sits at 9%.',
  links: ['https://docs.fernwave.example/trial-experiment'],
  constraints: ['Finance signs off on CAC'],
  deadline: '2026-11-15',
  reviewDate: '2026-12-15',
  status: 'framing',
  createdAt: '2026-10-20T17:00:00.000Z',
};

describe('FramePage', () => {
  it('F-04: the decision question is required; an empty submit shows an alert and focuses the field', async () => {
    const { user } = renderFrame('/decisions/new');
    await user.click(screen.getByRole('button', { name: 'Gather evidence' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/write the decision/i);
    const question = screen.getByLabelText('Decision question');
    expect(question).toHaveFocus();
    expect(question).toHaveAttribute('aria-invalid', 'true');
    expect(screen.queryByTestId('probe-path')).not.toBeInTheDocument();
  });

  it('F-04: creates a decision with the review date defaulting to today plus the Settings default, deadline optional', async () => {
    const state = signedInState();
    state.user!.defaultReviewDays = 60;
    const { user } = renderFrame('/decisions/new', state);

    const review = screen.getByLabelText('Review date');
    const expected = toIsoDate(addDays(new Date(), 60));
    expect(review).toHaveValue(expected);
    expect(screen.getByText(/defaults to 60 days from today/i)).toBeInTheDocument();
    expect(screen.getByLabelText('Deadline (optional)')).toHaveValue('');

    await user.type(screen.getByLabelText('Decision question'), 'Should we gate SSO behind the Team plan?');
    await user.click(screen.getByRole('button', { name: 'Gather evidence' }));

    const saved = await savedDecision();
    expect(screen.getByTestId('probe-path')).toHaveTextContent(`/decisions/${saved.id}/brief`);
    expect(saved.id).toMatch(/^d-/);
    expect(saved.question).toBe('Should we gate SSO behind the Team plan?');
    expect(saved.status).toBe('brief');
    expect(saved.reviewDate).toBe(expected);
    expect(saved.deadline).toBeUndefined();
    expect(Number.isNaN(Date.parse(saved.createdAt))).toBe(false);
  });

  it('F-04: an example decision prefills the question', async () => {
    const { user } = renderFrame('/decisions/new');
    await user.click(screen.getByRole('button', { name: 'Extend the free trial from 14 to 21 days?' }));
    expect(screen.getByLabelText('Decision question')).toHaveValue('Extend the free trial from 14 to 21 days?');
  });

  it('F-04: saves a deadline when one is given', async () => {
    const { user } = renderFrame('/decisions/new');
    await user.type(screen.getByLabelText('Decision question'), 'Build in-app referrals now?');
    await user.type(screen.getByLabelText('Deadline (optional)'), '2026-11-20');
    await user.click(screen.getByRole('button', { name: 'Gather evidence' }));
    expect((await savedDecision()).deadline).toBe('2026-11-20');
  });

  it('F-05: notes, links and constraints are saved as extra context', async () => {
    const { user } = renderFrame('/decisions/new');
    await user.type(screen.getByLabelText('Decision question'), 'Should we gate SSO behind the Team plan?');
    await user.type(screen.getByLabelText('Notes'), '4 of the last 10 lost enterprise deals asked for SSO.');

    const linkInput = screen.getByLabelText('Links');
    await user.type(linkInput, 'not a link');
    await user.click(screen.getByRole('button', { name: 'Add link' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/full link/i);

    await user.clear(linkInput);
    await user.type(linkInput, 'https://docs.fernwave.example/sso-plan');
    await user.click(screen.getByRole('button', { name: 'Add link' }));
    await user.type(linkInput, 'https://docs.fernwave.example/drop-me{Enter}');
    await user.click(screen.getByRole('button', { name: 'Remove link https://docs.fernwave.example/drop-me' }));

    const constraintInput = screen.getByLabelText('Constraints');
    await user.type(constraintInput, 'No new eng headcount{Enter}');
    await user.type(constraintInput, 'Ship before Q1 pricing review');
    await user.click(screen.getByRole('button', { name: 'Add constraint' }));
    await user.type(constraintInput, 'Temporary{Enter}');
    const chips = screen.getByRole('list', { name: 'Added constraints' });
    expect(within(chips).getAllByRole('listitem')).toHaveLength(3);
    await user.click(screen.getByRole('button', { name: 'Remove constraint Temporary' }));

    await user.click(screen.getByRole('button', { name: 'Gather evidence' }));
    const saved = await savedDecision();
    expect(saved.notes).toBe('4 of the last 10 lost enterprise deals asked for SSO.');
    expect(saved.links).toEqual(['https://docs.fernwave.example/sso-plan']);
    expect(saved.constraints).toEqual(['No new eng headcount', 'Ship before Q1 pricing review']);
  });

  it('F-04: editing prefills the form and a framing decision advances to brief', async () => {
    const { user } = renderFrame(
      '/decisions/d-trial-length/frame',
      signedInState({ decisions: [framingDecision] }),
    );
    expect(screen.getByRole('list', { name: 'Decision steps' })).toBeInTheDocument();
    expect(screen.getByLabelText('Decision question')).toHaveValue(framingDecision.question);
    expect(screen.getByLabelText('Notes')).toHaveValue(framingDecision.notes);
    expect(screen.getByLabelText('Deadline (optional)')).toHaveValue('2026-11-15');
    expect(screen.getByLabelText('Review date')).toHaveValue('2026-12-15');
    expect(screen.getByText('Finance signs off on CAC')).toBeInTheDocument();
    expect(screen.getByText('https://docs.fernwave.example/trial-experiment')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /extend the free trial/i })).not.toBeInTheDocument();

    const question = screen.getByLabelText('Decision question');
    await user.clear(question);
    await user.type(question, 'Extend the free trial to 21 days for self-serve only?');
    await user.click(screen.getByRole('button', { name: 'Save and view the brief' }));

    const saved = await savedDecision();
    expect(screen.getByTestId('probe-path')).toHaveTextContent('/decisions/d-trial-length/brief');
    expect(saved.question).toBe('Extend the free trial to 21 days for self-serve only?');
    expect(saved.status).toBe('brief');
    expect(saved.createdAt).toBe(framingDecision.createdAt);
  });

  it('F-04: editing never moves a decision backward', async () => {
    const { user } = renderFrame(
      '/decisions/d-trial-length/frame',
      signedInState({ decisions: [{ ...framingDecision, status: 'options' }] }),
    );
    await user.click(screen.getByRole('button', { name: 'Save and view the brief' }));
    expect((await savedDecision()).status).toBe('options');
  });

  it('F-04: an unknown decision id shows a helpful message and a link home', () => {
    renderApp('/decisions/d-nope/frame');
    expect(screen.getByRole('heading', { name: 'Decision not found' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to your decisions' })).toHaveAttribute('href', '/');
  });

  it('F-04: the new decision route renders inside the app', () => {
    renderApp('/decisions/new');
    expect(screen.getByRole('heading', { level: 1, name: 'Frame a decision' })).toBeInTheDocument();
  });
});
