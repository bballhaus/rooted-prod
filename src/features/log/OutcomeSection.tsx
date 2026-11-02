// F-16: what happened. On or after the review date (or any time before, if the
// PM already knows), they record a result, a short summary and the metrics.
import { useId, useState, type FormEvent } from 'react';
import { localToday } from '../../store/dashboard';
import { newId, useStore } from '../../store/store';
import type { Decision, Outcome } from '../../types';
import { formatDate } from './format';
import { RESULT_LABEL } from './outcome';

export function OutcomeSection({ decision }: { decision: Decision }) {
  const { state, dispatch } = useStore();
  const existing = state.outcomes.find((o) => o.decisionId === decision.id);
  const today = localToday();
  const due = !existing && !!decision.reviewDate && decision.reviewDate <= today;
  const [editing, setEditing] = useState(due);
  const [result, setResult] = useState<Outcome['result'] | ''>(existing?.result ?? '');
  const [summary, setSummary] = useState(existing?.summary ?? '');
  const [metrics, setMetrics] = useState(existing?.metrics ?? '');
  const [error, setError] = useState('');
  const uid = useId();

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!result) {
      setError('Pick how it turned out.');
      return;
    }
    dispatch({
      type: 'logOutcome',
      outcome: {
        id: existing?.id ?? newId('out'),
        decisionId: decision.id,
        result,
        summary: summary.trim(),
        metrics: metrics.trim(),
        loggedAt: new Date().toISOString(),
      },
    });
    setError('');
    setEditing(false);
  }

  return (
    <section id="outcome" aria-labelledby={`${uid}-title`} className={due ? 'card outcome outcome-due' : 'card outcome'}>
      <div className="card-section stack">
        <h2 id={`${uid}-title`} className="section-title">
          Outcome
        </h2>
        {due && (
          <p className="due-label">
            The review date ({formatDate(decision.reviewDate)}) has passed. What happened?
          </p>
        )}
        {!editing && existing && (
          <>
            <p>
              <strong>{RESULT_LABEL[existing.result]}.</strong> {existing.summary}
            </p>
            {existing.metrics && <p className="muted">Metrics: {existing.metrics}</p>}
            <p className="muted outcome-when">Logged {formatDate(existing.loggedAt)}</p>
            <p>
              <button type="button" className="btn btn-secondary" onClick={() => setEditing(true)}>
                Edit outcome
              </button>
            </p>
          </>
        )}
        {!editing && !existing && (
          <>
            <p className="muted">
              {decision.reviewDate
                ? `Rooted will ask on ${formatDate(decision.reviewDate)}.`
                : 'No review date set.'}
            </p>
            <p>
              <button type="button" className="btn btn-secondary" onClick={() => setEditing(true)}>
                Log the outcome now
              </button>
            </p>
          </>
        )}
        {editing && (
          <form className="stack" onSubmit={submit} noValidate>
            <fieldset className="field outcome-results">
              <legend className="label">How did it turn out?</legend>
              <div className="row">
                {(Object.keys(RESULT_LABEL) as Outcome['result'][]).map((r) => (
                  <label key={r} className="checkbox">
                    <input
                      type="radio"
                      name={`${uid}-result`}
                      value={r}
                      checked={result === r}
                      onChange={() => {
                        setResult(r);
                        setError('');
                      }}
                    />
                    {RESULT_LABEL[r]}
                  </label>
                ))}
              </div>
              {error && (
                <p role="alert" className="error">
                  {error}
                </p>
              )}
            </fieldset>
            <div className="field">
              <label htmlFor={`${uid}-summary`}>What happened</label>
              <textarea
                id={`${uid}-summary`}
                className="textarea"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="Activation went up, but support tickets about step 4 didn’t drop."
              />
            </div>
            <div className="field">
              <label htmlFor={`${uid}-metrics`}>Metrics (optional)</label>
              <input
                id={`${uid}-metrics`}
                className="input"
                value={metrics}
                onChange={(e) => setMetrics(e.target.value)}
                placeholder="Activation 31% → 38%"
              />
            </div>
            <div className="row">
              <button type="submit" className="btn">
                Save outcome
              </button>
              {(existing || !due) && (
                <button type="button" className="btn btn-ghost" onClick={() => setEditing(false)}>
                  Cancel
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
