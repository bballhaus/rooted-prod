// F-17: the PM's own decisions. In-progress ones first, then the logged history,
// with one search box over both.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../../store/store';
import type { Decision, OptionNode } from '../../types';
import { continuePath, formatDate, STATUS_LABEL } from './format';
import './log.css';

function matches(d: Decision, chosen: OptionNode | undefined, q: string): boolean {
  if (!q) return true;
  const hay = [d.question, d.notes, d.summary, d.rationale, chosen?.label, ...d.constraints]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => hay.includes(word));
}

export function DecisionsPage() {
  const { state } = useStore();
  const [query, setQuery] = useState('');
  const q = query.trim();
  const chosenOf = (d: Decision) => state.options.find((o) => o.id === d.chosenOptionId);

  const inProgress = state.decisions
    .filter((d) => d.status !== 'decided')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .filter((d) => matches(d, undefined, q));
  const logged = state.decisions
    .filter((d) => d.status === 'decided')
    .sort((a, b) => (b.loggedAt ?? b.createdAt).localeCompare(a.loggedAt ?? a.createdAt))
    .filter((d) => matches(d, chosenOf(d), q));

  const header = (
    <header className="row log-page-head">
      <div className="stack log-page-intro">
        <h1 className="page-title">Decisions</h1>
        <p className="lead">Every call you log, with what you chose, why, and what you passed on.</p>
      </div>
      <Link to="/decisions/new" className="btn btn-lg">
        New decision
      </Link>
    </header>
  );

  if (state.decisions.length === 0) {
    return (
      <div className="page">
        {header}
        <section className="card" aria-labelledby="decisions-empty">
          <div className="card-section stack">
            <h2 id="decisions-empty" className="section-title">
              Start with one decision.
            </h2>
            <p className="muted">
              Pick a call you're weighing this week, like a pricing change or what to cut from the sprint. Frame
              the question and Rooted gathers the context from Slack.
            </p>
            <p>
              <Link to="/decisions/new" className="btn">
                Frame your first decision
              </Link>
            </p>
          </div>
        </section>
      </div>
    );
  }

  const nothingFound = q && inProgress.length === 0 && logged.length === 0;

  return (
    <div className="page">
      {header}
      <div className="field log-search">
        <label htmlFor="decisions-search">Search decisions</label>
        <input
          id="decisions-search"
          type="search"
          className="input"
          placeholder="Question, choice or rationale"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <p className="visually-hidden" role="status">
        {q ? `${inProgress.length + logged.length} decisions match “${q}”` : ''}
      </p>

      {nothingFound ? (
        <p className="banner">No decisions match “{q}”.</p>
      ) : (
        <>
          {inProgress.length > 0 && (
            <section aria-labelledby="decisions-in-progress" className="stack">
              <h2 id="decisions-in-progress" className="section-title">
                In progress
              </h2>
              <ul className="log-list" aria-label="In progress">
                {inProgress.map((d) => (
                  <li key={d.id} className="card">
                    <div className="card-section log-item">
                      <div className="stack log-item-text">
                        <h3 className="log-item-title">{d.question || 'Untitled decision'}</h3>
                        <p className="row muted log-item-meta">
                          <span className="dot dot-alive" aria-hidden="true" />
                          <span>{STATUS_LABEL[d.status]}</span>
                          {d.deadline && <span className="tabular">Deadline {formatDate(d.deadline)}</span>}
                        </p>
                      </div>
                      <Link
                        to={continuePath(d)}
                        className="btn btn-secondary"
                        aria-label={`Continue: ${d.question || 'Untitled decision'}`}
                      >
                        Continue
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section aria-labelledby="decisions-logged" className="stack">
            <h2 id="decisions-logged" className="section-title">
              Logged
            </h2>
            {logged.length === 0 ? (
              <p className="muted">
                {q ? 'No logged decisions match.' : 'Nothing logged yet. Logged decisions show up here.'}
              </p>
            ) : (
              <ul className="log-list" aria-label="Logged">
                {logged.map((d) => {
                  const chosen = chosenOf(d);
                  return (
                    <li key={d.id}>
                      <Link to={`/decisions/${d.id}`} className="card log-item-link">
                        <div className="card-section stack">
                          <h3 className="log-item-title">{d.question}</h3>
                          <p className="row log-item-meta">
                            <span className="dot dot-chosen" aria-hidden="true" />
                            <span>
                              <span className="visually-hidden">Chose: </span>
                              {chosen?.label ?? 'Option not found'}
                            </span>
                          </p>
                          <p className="row muted log-item-meta tabular">
                            <span>Logged {formatDate(d.loggedAt)}</span>
                            {d.reviewDate && <span>Review {formatDate(d.reviewDate)}</span>}
                          </p>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
