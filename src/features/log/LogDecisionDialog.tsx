// F-14 / F-15: log the PM's choice in one step. The PM picks the option and
// writes a line or two; the fake agent drafts the rationale and a reason for
// every option not taken; the PM edits and logs it with one button.
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { draftRecord, type RecordDraft } from '../../agent/record';
import { Dialog } from '../../components/Dialog';
import { ReportWrongAnswer } from '../../components/ReportWrongAnswer';
import { useDecision, useStore } from '../../store/store';
import { depthOf, pathLabel, splitForLog, underPruned } from '../../store/tree';
import { addDays } from './format';
import './log.css';

export interface LogDecisionDialogProps {
  decisionId: string;
  open: boolean;
  onClose: () => void;
  chosenOptionId?: string;
}

export function LogDecisionDialog({ decisionId, open, onClose, chosenOptionId }: LogDecisionDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} title="Log decision">
      {/* Dialog only mounts children while open, so each opening starts fresh. */}
      <LogDecisionForm decisionId={decisionId} onClose={onClose} initialChoice={chosenOptionId} />
    </Dialog>
  );
}

type Step = 'choose' | 'drafting' | 'review';

function LogDecisionForm({
  decisionId,
  onClose,
  initialChoice,
}: {
  decisionId: string;
  onClose: () => void;
  initialChoice?: string;
}) {
  const { state, dispatch } = useStore();
  const navigate = useNavigate();
  const decision = useDecision(decisionId);
  const options = useMemo(() => state.options.filter((o) => o.decisionId === decisionId), [state.options, decisionId]);
  const choosable = options.filter((o) => o.state !== 'pruned' && !underPruned(options, o.id));

  const startChoice = choosable.some((o) => o.id === initialChoice) ? initialChoice! : '';
  const [choice, setChoice] = useState(startChoice);
  const [summary, setSummary] = useState(() => options.find((o) => o.id === startChoice)?.summary ?? '');
  const [summaryTouched, setSummaryTouched] = useState(false);
  const [errors, setErrors] = useState<{ choice?: string; summary?: string }>({});
  const [step, setStep] = useState<Step>('choose');
  const [rationale, setRationale] = useState('');
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState<RecordDraft | null>(null);
  const [logError, setLogError] = useState('');

  useEffect(() => {
    if (step !== 'drafting' || !decision) return;
    let cancelled = false;
    draftRecord(decision, options, choice, summary, state.contextItems).then((d) => {
      if (cancelled) return;
      setDraft(d);
      setRationale(d.rationale);
      setReasons(Object.fromEntries(d.rejected.map((r) => [r.optionId, r.reason])));
      setStep('review');
    });
    return () => {
      cancelled = true;
    };
    // Draft once per entry into the drafting step; inputs are frozen meanwhile.
  }, [step]);

  if (!decision) {
    return <p>We couldn't find that decision.</p>;
  }
  if (choosable.length === 0) {
    return (
      <div className="stack">
        <p>There are no open options left to choose. Add or restore an option on the options page first.</p>
        <div className="row">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    );
  }

  const chosen = options.find((o) => o.id === choice);
  const split = chosen ? splitForLog(options, chosen.id) : undefined;
  const rejected = split?.alternatives ?? [];
  // Options under an alternative are pruned with it; show them so nothing is pruned unseen.
  const prunedWith = split ? split.notTaken.filter((o) => !rejected.includes(o)) : [];

  function pick(id: string) {
    setChoice(id);
    setErrors((e) => ({ ...e, choice: undefined }));
    if (!summaryTouched) setSummary(options.find((o) => o.id === id)?.summary ?? '');
  }

  function startDraft(e: React.FormEvent) {
    e.preventDefault();
    const next: typeof errors = {};
    if (!choice) next.choice = 'Pick the option you’re going with.';
    if (!summary.trim()) next.summary = 'Write a line or two about the call.';
    setErrors(next);
    if (next.choice || next.summary) return;
    setStep('drafting');
  }

  function log() {
    if (!decision || !chosen) return;
    if (!rationale.trim()) {
      setLogError('Add a rationale before logging.');
      return;
    }
    // A rejected option is always kept with its reason (F-18).
    if (rejected.some((o) => !(reasons[o.id] ?? '').trim())) {
      setLogError('Give a reason for every option not taken.');
      return;
    }
    const loggedAt = new Date().toISOString();
    dispatch({
      type: 'logDecision',
      decisionId,
      chosenOptionId: chosen.id,
      summary: summary.trim(),
      rationale: rationale.trim(),
      pruned: rejected.map((o) => ({ optionId: o.id, reason: (reasons[o.id] ?? '').trim() })),
      loggedAt,
    });
    if (!decision.reviewDate) {
      dispatch({
        type: 'updateDecision',
        decisionId,
        patch: { reviewDate: addDays(loggedAt, state.user?.defaultReviewDays ?? 30) },
      });
    }
    navigate(`/decisions/${decisionId}`);
    onClose();
  }

  if (step === 'choose') {
    return (
      <form className="stack" onSubmit={startDraft} noValidate>
        <p className="muted log-question">{decision.question}</p>
        <fieldset className="log-fieldset" aria-describedby={errors.choice ? 'log-choice-error' : undefined}>
          <legend className="label log-legend">Which option are you going with?</legend>
          {choosable.map((o) => (
            <label key={o.id} className={`log-option${choice === o.id ? ' log-option-chosen' : ''}`}>
              <input
                type="radio"
                name="log-choice"
                value={o.id}
                checked={choice === o.id}
                onChange={() => pick(o.id)}
              />
              <span className="log-option-text">
                <span className="log-option-label">{o.label}</span>
                {depthOf(options, o.id) > 0 && (
                  <span className="log-option-path">Under {pathLabel(options, o.parentId!)}</span>
                )}
                <span className="log-option-summary">{o.summary}</span>
              </span>
            </label>
          ))}
          {errors.choice && (
            <p id="log-choice-error" className="error" role="alert">
              {errors.choice}
            </p>
          )}
        </fieldset>
        <div className="field">
          <label htmlFor="log-summary">Your summary</label>
          <span className="hint" id="log-summary-hint">
            One or two lines in your words. Rooted drafts the rest for you to edit.
          </span>
          <textarea
            id="log-summary"
            className="textarea log-summary"
            rows={2}
            value={summary}
            aria-describedby={errors.summary ? 'log-summary-hint log-summary-error' : 'log-summary-hint'}
            aria-invalid={errors.summary ? true : undefined}
            onChange={(e) => {
              setSummary(e.target.value);
              setSummaryTouched(true);
              if (e.target.value.trim()) setErrors((er) => ({ ...er, summary: undefined }));
            }}
          />
          {errors.summary && (
            <p id="log-summary-error" className="error" role="alert">
              {errors.summary}
            </p>
          )}
        </div>
        <div className="row">
          <button type="submit" className="btn">
            Draft the rest
          </button>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    );
  }

  if (step === 'drafting') {
    return (
      <div className="row" role="status">
        <span className="spinner" aria-hidden="true" />
        <span>Drafting the rationale and reasons for the options not taken…</span>
      </div>
    );
  }

  return (
    <div className="stack">
      {chosen && (
        <div className="card card-rec log-chosen">
          <div className="card-section">
            <span className="log-chosen-kicker">Your choice</span>
            <p className="log-chosen-label">{pathLabel(options, chosen.id)}</p>
            <p className="log-chosen-summary">{summary.trim()}</p>
          </div>
        </div>
      )}
      <p className="muted log-draft-note">
        Rooted drafted the rest from your summary and the evidence. Edit anything that’s off.
      </p>
      <div className="field">
        <label htmlFor="log-rationale">Rationale</label>
        <textarea
          id="log-rationale"
          className="textarea"
          value={rationale}
          onChange={(e) => {
            setRationale(e.target.value);
            if (e.target.value.trim()) setLogError('');
          }}
        />
        <div className="row">
          <ReportWrongAnswer
            surface="record"
            targetId={decisionId}
            decisionId={decisionId}
            excerpt={draft?.rationale}
          />
        </div>
      </div>
      {rejected.length > 0 && (
        <fieldset className="log-fieldset stack">
          <legend className="label log-legend">Options not taken</legend>
          {rejected.map((o) => (
            <div key={o.id} className="field">
              <label htmlFor={`log-reason-${o.id}`} className="row log-reason-label">
                <span className="dot dot-pruned" aria-hidden="true" />
                <span>Why not {o.label}?</span>
              </label>
              <textarea
                id={`log-reason-${o.id}`}
                className="textarea log-reason"
                rows={2}
                value={reasons[o.id] ?? ''}
                onChange={(e) => setReasons((r) => ({ ...r, [o.id]: e.target.value }))}
              />
            </div>
          ))}
        </fieldset>
      )}
      {prunedWith.length > 0 && (
        <div className="stack">
          <p className="label log-legend">Also pruned with their branch</p>
          <ul className="log-pruned-with">
            {prunedWith.map((o) => (
              <li key={o.id}>
                <span className="pruned-label">{pathLabel(options, o.id)}</span>
              </li>
            ))}
          </ul>
          <p className="muted log-draft-note">Each keeps the reason you give for the branch above it.</p>
        </div>
      )}
      {logError && (
        <p className="error" role="alert">
          {logError}
        </p>
      )}
      <div className="row">
        <button type="button" className="btn" onClick={log}>
          Log decision
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => setStep('choose')}>
          Back
        </button>
      </div>
    </div>
  );
}
