import { screen, within } from '@testing-library/react';
import { useState } from 'react';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { draftRecord } from '../../agent/record';
import { DEFAULT_ANSWERS, fakeAi } from '../../test/fakeAi';
import { useStore } from '../../store/store';
import { renderApp, renderWithStore } from '../../test/render';
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

function renderDialog(chosenOptionId?: string, state = trialState(), ai = fakeAi()) {
  return renderWithStore(
    <>
      <Spy />
      <Routes>
        <Route path="/" element={<Harness chosenOptionId={chosenOptionId} />} />
        <Route path="/decisions/:id" element={<DecisionRecordPage />} />
      </Routes>
    </>,
    state,
    { ai },
  );
}

describe('draftRecord', () => {
  const state = () => ({ ...trialState(), contextItems: trialContext });

  it('F-15: sends the PM’s summary, the chosen option, the alternatives and the evidence', async () => {
    const ai = fakeAi();
    const draft = await draftRecord(ai, trialDecision, trialOptions, 'o-t-30', 'Go to 30 days for Q4', state());
    const [task, payload] = ai.run.mock.calls[0];
    expect(task).toBe('draftRecord');
    expect(payload.summary).toBe('Go to 30 days for Q4');
    expect(payload.chosen.id).toBe('o-t-30');
    expect(payload.others.map((o: { id: string }) => o.id).sort()).toEqual(['o-t-14', 'o-t-usage']);
    expect(payload.evidence.map((e: { text: string }) => e.text).join(' ')).not.toContain('Removed note');
    expect(draft.rationale).toBe('30-day trial fits the evidence best.');
  });

  it('F-08: never sends context the PM marked wrong', async () => {
    const ai = fakeAi();
    const flagged = trialContext.map((c) => (c.id === 'c-t-1' ? { ...c, flaggedInaccurate: true } : c));
    await draftRecord(ai, trialDecision, trialOptions, 'o-t-30', 'Go to 30 days', { ...state(), contextItems: flagged });
    expect(ai.run.mock.calls[0][1].evidence.map((e: { id: string }) => e.id)).not.toContain('c-t-1');
  });

  it('F-15: one reason per option not taken, and a reason the PM already wrote wins over a drafted one', async () => {
    const draft = await draftRecord(fakeAi(), trialDecision, trialOptions, 'o-t-30', 'Go to 30 days', state());
    expect(draft.rejected.map((r) => r.optionId).sort()).toEqual(['o-t-14', 'o-t-usage']);
    expect(draft.rejected.find((r) => r.optionId === 'o-t-usage')?.reason).toBe(trialOptions[2].pruneReason);
    expect(draft.rejected.find((r) => r.optionId === 'o-t-14')?.reason).toBe('14-day trial costs more for less.');
  });

  it('F-15: when Claude can’t draft, it says why, can retry, and the PM can write the record themselves', async () => {
    const ai = fakeAi({ draftRecord: 'provider_busy' });
    const { user } = renderDialog('o-t-30', trialState(), ai);
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Draft the rest' }));
    expect(await within(dialog).findByText(/The AI is busy right now/, {}, WAIT)).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Rationale')).toHaveValue('');
    // A reason the PM wrote when pruning is still there to keep.
    expect(within(dialog).getByDisplayValue(trialOptions[2].pruneReason!)).toBeInTheDocument();
    ai.answers.draftRecord = undefined;
    delete ai.answers.draftRecord;
    await user.click(within(dialog).getByRole('button', { name: 'Try again' }));
    expect(await within(dialog).findByDisplayValue('30-day trial fits the evidence best.', {}, WAIT)).toBeInTheDocument();
  });
});

describe('LogDecisionDialog', () => {
  it('F-14: one "Log decision" action logs the choice and rationale, prunes the rest with reasons, and opens the record', async () => {
    let finishDraft: () => void = () => {};
    const ai = fakeAi({
      draftRecord: (p: Parameters<typeof DEFAULT_ANSWERS.draftRecord>[0]) => new Promise((resolve) => (finishDraft = () => resolve(DEFAULT_ANSWERS.draftRecord(p)))),
    });
    const { user } = renderDialog('o-t-30', trialState(), ai);
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
    finishDraft();
    await within(dialog).findByLabelText('Rationale', {}, WAIT);

    expect(within(dialog).getAllByRole('button', { name: 'Log decision' })).toHaveLength(1);
    await user.click(within(dialog).getByRole('button', { name: 'Log decision' }));

    expect(await screen.findByRole('heading', { level: 1, name: trialDecision.question })).toBeInTheDocument();
    const d = latest!.decisions.find((x) => x.id === 'd-trial')!;
    expect(d.status).toBe('decided');
    expect(d.chosenOptionId).toBe('o-t-30');
    expect(d.summary).toBe('Extend the trial to 30 days for every workspace.');
    expect(d.rationale).toBe('30-day trial fits the evidence best.');
    expect(d.loggedAt).toBeTruthy();
    const opts = latest!.options.filter((o) => o.decisionId === 'd-trial');
    expect(opts.find((o) => o.id === 'o-t-30')!.state).toBe('chosen');
    expect(opts.find((o) => o.id === 'o-t-14')!.state).toBe('pruned');
    expect(opts.find((o) => o.id === 'o-t-14')!.pruneReason).toBe('14-day trial costs more for less.');
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
    const ai = fakeAi();
    const { user } = renderDialog('o-t-30', trialState(), ai);
    const dialog = screen.getByRole('dialog');
    const summary = within(dialog).getByLabelText('Your summary');
    await user.clear(summary);
    await user.type(summary, 'Thirty days, so teams get past the day-10 invite.');
    await user.click(within(dialog).getByRole('button', { name: 'Draft the rest' }));
    const rationale = await within(dialog).findByLabelText('Rationale', {}, WAIT);
    // The PM's summary goes to Claude; its draft fills the rationale for the PM to edit.
    expect(ai.run.mock.calls[0][1].summary).toBe('Thirty days, so teams get past the day-10 invite.');
    expect(rationale).toHaveValue('30-day trial fits the evidence best.');

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
    expect(screen.getByRole('link', { name: 'Continue' })).toHaveAttribute('href', '/decisions/d-trial/work');
  });
});
