// F-14 / F-18: the logged record of one decision: the choice, the rationale,
// the options not taken and why, and the context behind it.
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ReportWrongAnswer } from '../../components/ReportWrongAnswer';
import { Stepper } from '../../components/Stepper';
import { useDecision, useStore } from '../../store/store';
import { continuePath, formatDate, STATUS_LABEL } from './format';
import './log.css';

export function DecisionRecordPage() {
  const { id } = useParams();
  const { state, dispatch } = useStore();
  const decision = useDecision(id);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  if (!decision) {
    return (
      <div className="page">
        <h1 className="page-title">Decision not found</h1>
        <p className="lead">We couldn't find that decision. It may have been deleted.</p>
        <p>
          <Link to="/" className="btn btn-secondary">
            Back to decisions
          </Link>
        </p>
      </div>
    );
  }

  if (decision.status !== 'decided') {
    return (
      <div className="page">
        <Stepper decision={decision} current={decision.status} />
        <h1 className="page-title">{decision.question}</h1>
        <p className="lead">Not logged yet. {STATUS_LABEL[decision.status]}.</p>
        <p>
          <Link to={continuePath(decision)} className="btn">
            Continue
          </Link>
        </p>
      </div>
    );
  }

  const options = state.options.filter((o) => o.decisionId === decision.id);
  const chosen = options.find((o) => o.id === decision.chosenOptionId);
  const notTaken = options.filter((o) => o.id !== decision.chosenOptionId);
  const context = state.contextItems.filter((c) => c.decisionId === decision.id && !c.removed);

  function saveRationale(e: React.FormEvent) {
    e.preventDefault();
    if (!decision || !draft.trim()) return;
    dispatch({ type: 'updateDecision', decisionId: decision.id, patch: { rationale: draft.trim() } });
    setEditing(false);
  }

  return (
    <div className="page">
      <Stepper decision={decision} current="decided" />
      <header className="stack">
        <span className="kicker">Decision record</span>
        <h1 className="page-title">{decision.question}</h1>
      </header>

      <div className="log-record-grid">
        <div className="stack log-record-main">
          <section aria-labelledby="record-choice" className="card card-rec">
            <div className="card-section stack">
              <h2 id="record-choice" className="log-chosen-kicker">
                <span className="dot dot-chosen" aria-hidden="true" /> Your choice
              </h2>
              <p className="log-chosen-label">{chosen?.label ?? 'Option not found'}</p>
              {chosen?.summary && <p className="log-chosen-summary">{chosen.summary}</p>}
            </div>
          </section>

          {decision.summary && (
            <section aria-labelledby="record-summary" className="stack">
              <h2 id="record-summary" className="section-title">
                Summary
              </h2>
              <p className="log-prose">{decision.summary}</p>
            </section>
          )}

          <section aria-labelledby="record-rationale" className="stack">
            <h2 id="record-rationale" className="section-title">
              Rationale
            </h2>
            {editing ? (
              <form className="stack" onSubmit={saveRationale}>
                <div className="field">
                  <label htmlFor="record-rationale-input">Edit rationale</label>
                  <textarea
                    id="record-rationale-input"
                    className="textarea"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                  />
                </div>
                <div className="row">
                  <button type="submit" className="btn" disabled={!draft.trim()}>
                    Save rationale
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => setEditing(false)}>
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <>
                <p className="log-prose">{decision.rationale || 'No rationale recorded.'}</p>
                <div className="row">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      setDraft(decision.rationale ?? '');
                      setEditing(true);
                    }}
                  >
                    Edit rationale
                  </button>
                  <ReportWrongAnswer
                    surface="record"
                    targetId={decision.id}
                    decisionId={decision.id}
                    excerpt={decision.rationale}
                  />
                </div>
              </>
            )}
          </section>

          <section aria-labelledby="record-not-taken" className="stack">
            <h2 id="record-not-taken" className="section-title">
              Options not taken
            </h2>
            {notTaken.length === 0 ? (
              <p className="muted">There were no other options on this decision.</p>
            ) : (
              <ul className="log-list">
                {notTaken.map((o) => (
                  <li key={o.id} className="card">
                    <div className="card-section stack log-pruned">
                      <p className="row log-pruned-head">
                        <span className="dot dot-pruned" aria-hidden="true" />
                        <span className="pruned-label">{o.label}</span>
                        <span className="visually-hidden">(pruned)</span>
                      </p>
                      <p className="log-prose">
                        <span className="muted">Why not: </span>
                        {o.pruneReason?.trim() || 'No reason recorded.'}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <details className="log-details">
            <summary>Context snapshot ({context.length})</summary>
            {context.length === 0 ? (
              <p className="muted">No context was gathered for this decision.</p>
            ) : (
              <ul className="log-list">
                {context.map((c) => (
                  <li key={c.id} className="log-context">
                    <p className="log-context-meta muted">
                      {c.sourceLabel}
                      {c.author ? ` · ${c.author}` : ''} · <span className="tabular">{formatDate(c.date)}</span>
                    </p>
                    <p className="log-prose">{c.snippet}</p>
                  </li>
                ))}
              </ul>
            )}
          </details>
        </div>

        <aside className="stack log-record-side" aria-label="Dates and constraints">
          <dl className="log-meta">
            <div>
              <dt>Logged</dt>
              <dd className="tabular">{formatDate(decision.loggedAt) || 'Not recorded'}</dd>
            </div>
            {decision.deadline && (
              <div>
                <dt>Deadline</dt>
                <dd className="tabular">{formatDate(decision.deadline)}</dd>
              </div>
            )}
            <div>
              <dt>Review date</dt>
              <dd className="tabular">
                {decision.reviewDate ? `Outcome review: ${formatDate(decision.reviewDate)}` : 'Not set'}
              </dd>
            </div>
          </dl>
          {decision.reviewDate && <p className="muted log-note">We'll ask what happened on the review date.</p>}
          {decision.constraints.length > 0 && (
            <section aria-labelledby="record-constraints" className="stack">
              <h2 id="record-constraints" className="log-side-title">
                Constraints
              </h2>
              <ul className="log-constraints">
                {decision.constraints.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
