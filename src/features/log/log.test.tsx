import { screen, within } from '@testing-library/react';
import { useState } from 'react';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { draftRecordNow } from '../../agent/record';
import { useStore } from '../../store/store';
import { renderApp, renderWithStore, signedInState } from '../../test/render';
import type { AppState } from '../../types';
import { DecisionRecordPage } from './DecisionRecordPage';
import { LogDecisionDialog } from './LogDecisionDialog';
import { trialContext, trialDecision, trialOptions, trialState } from './testData';

const WAIT = { timeout: 3000 };

// Exposes the store so tests can check what was logged.
let latest: AppState | null = null;
function Spy() {
  latest = useStore().state;
  return null;
}

function Harness({ chosenOptionId }: { chosenOptionId?: string }) {
  const [open, setOpen] = useState(true);
  return (
    <>
      <p>Options page</p>
      <LogDecisionDialog decisionId="d-trial" open={open} onClose={() => setOpen(false)} chosenOptionId={chosenOptionId} />
    </>
  );
}

function renderDialog(chosenOptionId?: string, state = trialState()) {
  return renderWithStore(
    <>
      <Spy />
      <Routes>
        <Route path="/" element={<Harness chosenOptionId={chosenOptionId} />} />
        <Route path="/decisions/:id" element={<DecisionRecordPage />} />
      </Routes>
    </>,
    state,
  );
}

describe('draftRecord', () => {
  it('F-15: drafts a rationale from the summary, the chosen option and cited context', () => {
    const draft = draftRecordNow(trialDecision, trialOptions, 'o-t-30', 'Go to 30 days for Q4', trialContext);
    expect(draft.rationale).toContain('Go to 30 days for Q4.');
    expect(draft.rationale).toContain('covers the day-10 invite spike');
    expect(draft.rationale).toContain('62% of converting workspaces');
    expect(draft.rationale).not.toContain('Removed note');
  });

  it('F-08: never cites context the PM marked wrong', () => {
    const flagged = trialContext.map((c) => (c.id === 'c-t-1' ? { ...c, flaggedInaccurate: true } : c));
    const draft = draftRecordNow(trialDecision, trialOptions, 'o-t-30', 'Go to 30 days', flagged);
    expect(draft.rationale).not.toContain('62% of converting workspaces');
  });

  it('F-15: drafts one reason per option not taken, reusing an existing prune reason', () => {
    const draft = draftRecordNow(trialDecision, trialOptions, 'o-t-30', 'Go to 30 days', trialContext);
    expect(draft.rejected.map((r) => r.optionId).sort()).toEqual(['o-t-14', 'o-t-usage']);
    expect(draft.rejected.find((r) => r.optionId === 'o-t-usage')?.reason).toBe(trialOptions[2].pruneReason);
    expect(draft.rejected.find((r) => r.optionId === 'o-t-14')?.reason).toMatch(/ends before most teams invite/i);
  });
});

describe('LogDecisionDialog', () => {
  it('F-14: one "Log decision" action logs the choice and rationale, prunes the rest with reasons, and opens the record', async () => {
    const { user } = renderDialog('o-t-30');
    const dialog = screen.getByRole('dialog');
    // Preselected, summary prefilled from the chosen option.
    expect(within(dialog).getByRole('radio', { name: /30-day trial/ })).toBeChecked();
    expect(within(dialog).getByLabelText('Your summary')).toHaveValue(
      'Extend the trial to 30 days for every workspace.',
    );
    // Pruned options aren't choosable.
    expect(within(dialog).queryByRole('radio', { name: /Usage-based/ })).not.toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Draft the rest' }));
    expect(within(dialog).getByRole('status')).toHaveTextContent(/drafting/i);
    await within(dialog).findByLabelText('Rationale', {}, WAIT);

    expect(within(dialog).getAllByRole('button', { name: 'Log decision' })).toHaveLength(1);
    await user.click(within(dialog).getByRole('button', { name: 'Log decision' }));

    expect(await screen.findByRole('heading', { level: 1, name: trialDecision.question })).toBeInTheDocument();
    const d = latest!.decisions.find((x) => x.id === 'd-trial')!;
    expect(d.status).toBe('decided');
    expect(d.chosenOptionId).toBe('o-t-30');
    expect(d.summary).toBe('Extend the trial to 30 days for every workspace.');
    expect(d.rationale).toMatch(/covers the day-10 invite spike/);
    expect(d.loggedAt).toBeTruthy();
    const opts = latest!.options.filter((o) => o.decisionId === 'd-trial');
    expect(opts.find((o) => o.id === 'o-t-30')!.state).toBe('chosen');
    expect(opts.find((o) => o.id === 'o-t-14')!.state).toBe('pruned');
    expect(opts.find((o) => o.id === 'o-t-14')!.pruneReason).toMatch(/ends before most teams invite/i);
    expect(opts.find((o) => o.id === 'o-t-usage')!.pruneReason).toBe(trialOptions[2].pruneReason);
  });

  it('F-14: with no preselected option, the PM must pick one and write a summary', async () => {
    const { user } = renderDialog();
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('radio', { name: /14-day trial/ })).not.toBeChecked();
    expect(within(dialog).getByRole('radio', { name: /30-day trial/ })).not.toBeChecked();
    await user.click(within(dialog).getByRole('button', { name: 'Draft the rest' }));
    const alerts = within(dialog).getAllByRole('alert');
    expect(alerts.map((a) => a.textContent).join(' ')).toMatch(/pick the option/i);
    expect(alerts.map((a) => a.textContent).join(' ')).toMatch(/line or two/i);

    await user.click(within(dialog).getByRole('radio', { name: /14-day trial/ }));
    expect(within(dialog).getByLabelText('Your summary')).toHaveValue('Keep the current 14-day trial.');
  });

  it('F-14: the chosen option is marked wine and options not taken are not', async () => {
    const { user } = renderDialog('o-t-30');
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Draft the rest' }));
    await within(dialog).findByLabelText('Rationale', {}, WAIT);
    const wine = dialog.querySelectorAll('.card-rec, .pill-rec, .dot-chosen');
    expect(wine).toHaveLength(1);
    expect(wine[0]).toHaveTextContent('30-day trial');
    expect(wine[0]).not.toHaveTextContent('14-day trial');
    expect(within(dialog).getByLabelText(/Why not 14-day trial/)).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/Why not Usage-based trial/)).toHaveValue(trialOptions[2].pruneReason);
    expect(within(dialog).getByRole('button', { name: 'Report wrong answer' })).toBeInTheDocument();
  });

  it('F-15: edits to the drafted rationale and reasons persist in the logged record', async () => {
    const { user } = renderDialog('o-t-30');
    const dialog = screen.getByRole('dialog');
    const summary = within(dialog).getByLabelText('Your summary');
    await user.clear(summary);
    await user.type(summary, 'Thirty days, so teams get past the day-10 invite.');
    await user.click(within(dialog).getByRole('button', { name: 'Draft the rest' }));
    const rationale = await within(dialog).findByLabelText('Rationale', {}, WAIT);
    expect((rationale as HTMLTextAreaElement).value).toContain('Thirty days, so teams get past the day-10 invite.');

    await user.clear(rationale);
    await user.type(rationale, 'Edited: the invite spike lands after day 10.');
    const reason = within(dialog).getByLabelText(/Why not 14-day trial/);
    await user.clear(reason);
    await user.type(reason, 'Too short for team rollouts.');
    await user.click(within(dialog).getByRole('button', { name: 'Log decision' }));

    await screen.findByRole('heading', { level: 1, name: trialDecision.question });
    expect(screen.getByText('Edited: the invite spike lands after day 10.')).toBeInTheDocument();
    expect(screen.getByText('Too short for team rollouts.')).toBeInTheDocument();
    expect(latest!.decisions.find((x) => x.id === 'd-trial')!.summary).toBe(
      'Thirty days, so teams get past the day-10 invite.',
    );
  });
});

describe('LogDecisionDialog reasons', () => {
  it('F-18: every option not taken needs a reason before the decision is logged', async () => {
    const { user } = renderDialog('o-t-30');
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Draft the rest' }));
    const reason = await within(dialog).findByLabelText(/Why not 14-day trial/, {}, WAIT);
    await user.clear(reason);
    await user.click(within(dialog).getByRole('button', { name: 'Log decision' }));
    expect(within(dialog).getByText('Give a reason for every option not taken.')).toBeInTheDocument();
    expect(latest!.decisions.find((x) => x.id === 'd-trial')!.status).not.toBe('decided');
  });
});

describe('LogDecisionDialog with sub-options', () => {
  const sub = (id: string, parentId: string, label: string) => ({
    ...trialOptions[1],
    id,
    parentId,
    label,
    summary: `${label}.`,
    pros: [],
    cons: [],
    state: 'open' as const,
    pruneReason: undefined,
  });

  it('F-14: choosing a sub-option asks reasons only for the alternatives and logs the full path', async () => {
    const s = trialState();
    s.options.push(
      sub('o-t-30-team', 'o-t-30', 'Team plan only'),
      sub('o-t-30-all', 'o-t-30', 'All plans'),
      sub('o-t-14-emails', 'o-t-14', 'With onboarding emails'),
    );
    const { user } = renderDialog('o-t-30-team', s);
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getAllByText('Under 30-day trial')).toHaveLength(2);
    await user.click(within(dialog).getByRole('button', { name: 'Draft the rest' }));
    await within(dialog).findByLabelText('Rationale', {}, WAIT);

    expect(within(dialog).getByLabelText(/Why not 14-day trial/)).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/Why not All plans/)).toBeInTheDocument();
    expect(within(dialog).queryByLabelText(/Why not 30-day trial/)).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText(/Why not With onboarding emails/)).not.toBeInTheDocument();
    expect(within(dialog).getByText('14-day trial › With onboarding emails')).toBeInTheDocument();

    await user.clear(within(dialog).getByLabelText(/Why not All plans/));
    await user.click(within(dialog).getByRole('button', { name: 'Log decision' }));
    expect(within(dialog).getByText('Give a reason for every option not taken.')).toBeInTheDocument();

    await user.type(within(dialog).getByLabelText(/Why not All plans/), 'Starter teams add support load.');
    await user.click(within(dialog).getByRole('button', { name: 'Log decision' }));
    await screen.findByRole('heading', { level: 1, name: trialDecision.question });
    expect(screen.getAllByText('30-day trial › Team plan only').length).toBeGreaterThan(0);
    const logged = latest!.options;
    expect(logged.find((o) => o.id === 'o-t-30')!.state).toBe('open');
    expect(logged.find((o) => o.id === 'o-t-30-all')!.pruneReason).toBe('Starter teams add support load.');
  });
});

describe('DecisionRecordPage', () => {
  it('F-18: shows the options not taken with their prune reasons', () => {
    renderApp('/decisions/d-onboarding-checklist');
    expect(screen.getByRole('heading', { level: 1, name: /checklist or a guided tour/ })).toBeInTheDocument();
    const notTaken = screen.getByRole('region', { name: 'Options not taken' });
    expect(within(notTaken).getByText('Guided product tour')).toHaveClass('pruned-label');
    expect(within(notTaken).getByText(/one-time tour misses them/)).toBeInTheDocument();
    expect(within(notTaken).queryByText('Setup checklist')).not.toBeInTheDocument();
    const choice = screen.getByRole('region', { name: 'Your choice' });
    expect(choice).toHaveClass('card-rec');
    expect(choice).toHaveTextContent('Setup checklist');
    expect(screen.getByText(/Outcome review: Oct 15, 2026/)).toBeInTheDocument();
  });

  it('F-14: shows a context snapshot of non-removed items and handles none', () => {
    renderApp('/decisions/d-onboarding-checklist');
    expect(screen.getByText(/came back two days later/)).toBeInTheDocument();
    renderApp('/decisions/d-pricing-seats');
    expect(screen.getByText('No context was gathered for this decision.')).toBeInTheDocument();
  });

  it('F-15: the rationale is editable on the record page', async () => {
    const { user } = renderApp('/decisions/d-mobile-push');
    await user.click(screen.getByRole('button', { name: 'Edit rationale' }));
    const box = screen.getByLabelText('Edit rationale');
    await user.clear(box);
    await user.type(box, 'Digests first; revisit push when mobile passes 15% of weekly actives.');
    await user.click(screen.getByRole('button', { name: 'Save rationale' }));
    expect(screen.getByText(/revisit push when mobile passes 15%/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Report wrong answer' })).toBeInTheDocument();
  });

  it('F-17: an unknown decision shows a message and a way home', () => {
    renderApp('/decisions/d-nope');
    expect(screen.getByRole('heading', { name: 'Decision not found' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to decisions' })).toHaveAttribute('href', '/');
  });

  it('F-17: a decision not logged yet links back to its current step', () => {
    renderApp('/decisions/d-trial', trialState());
    expect(screen.getByText(/Not logged yet/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Continue' })).toHaveAttribute('href', '/decisions/d-trial/options');
  });
});

describe('DecisionsPage', () => {
  it('F-17: lists in-progress decisions first, then logged ones newest first', () => {
    renderApp('/', trialState());
    const inProgress = screen.getByRole('list', { name: 'In progress' });
    expect(within(inProgress).getByText(trialDecision.question)).toBeInTheDocument();
    expect(within(inProgress).getByRole('link', { name: /Continue/ })).toHaveAttribute(
      'href',
      '/decisions/d-trial/options',
    );
    const logged = within(screen.getByRole('list', { name: 'Logged' })).getAllByRole('link');
    expect(logged.map((l) => l.getAttribute('href'))).toEqual([
      '/decisions/d-mobile-push',
      '/decisions/d-pricing-seats',
      '/decisions/d-onboarding-checklist',
    ]);
    expect(logged[0]).toHaveTextContent('Email digests first');
    expect(logged[0]).toHaveTextContent('Review Dec 1, 2026');
    // In progress comes before logged in the page.
    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(headings.indexOf('In progress')).toBeLessThan(headings.indexOf('Logged'));
    const cta = screen.getAllByRole('link', { name: 'New decision' }).find((l) => l.classList.contains('btn'));
    expect(cta).toHaveAttribute('href', '/decisions/new');
  });

  it('F-17: search filters both in-progress and logged decisions', async () => {
    const { user } = renderApp('/', trialState());
    const search = screen.getByLabelText('Search decisions');
    await user.type(search, 'seat');
    expect(screen.queryByRole('list', { name: 'In progress' })).not.toBeInTheDocument();
    const logged = within(screen.getByRole('list', { name: 'Logged' })).getAllByRole('link');
    expect(logged).toHaveLength(1);
    expect(logged[0]).toHaveTextContent('Charge per seat or per workspace');

    await user.clear(search);
    await user.type(search, 'trial');
    expect(within(screen.getByRole('list', { name: 'In progress' })).getByText(trialDecision.question)).toBeInTheDocument();

    await user.clear(search);
    await user.type(search, 'zebra');
    expect(screen.getByText(/No decisions match/)).toBeInTheDocument();
  });

  it('F-17: with no decisions, prompts the PM to frame the first one', () => {
    renderApp('/', signedInState({ decisions: [], options: [], contextItems: [] }));
    expect(screen.getByRole('heading', { name: 'Start with one decision.' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Frame your first decision' })).toHaveAttribute('href', '/decisions/new');
  });

  it('F-17: a logged decision opens its record', async () => {
    const { user } = renderApp('/');
    await user.click(screen.getByRole('link', { name: /Build mobile push notifications/ }));
    expect(screen.getByRole('heading', { level: 1, name: /Build mobile push notifications/ })).toBeInTheDocument();
  });
});
