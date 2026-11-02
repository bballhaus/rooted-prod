import { useId, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { newId, useStore } from '../../store/store';
import type { WrongAnswerReport } from '../../types';
import { FAQ, FAQ_TOPICS } from './faq';
import './help.css';

// Help: searchable FAQ (F-27), report a wrong answer and contact support (F-28).

export function HelpPage() {
  return (
    <div className="page help-page">
      <header className="stack">
        <h1 className="page-title">Help</h1>
        <p className="lead">Answers about this prototype, a place to report a wrong answer, and a way to reach us.</p>
      </header>
      <FaqSection />
      <div className="grid-2 help-forms">
        <ReportSection />
        <SupportSection />
      </div>
      <ReportsList />
    </div>
  );
}

function FaqSection() {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const matches = useMemo(
    () =>
      q
        ? FAQ.filter((f) => f.question.toLowerCase().includes(q) || f.answer.toLowerCase().includes(q))
        : FAQ,
    [q],
  );

  return (
    <section className="stack" aria-labelledby="help-faq-title">
      <h2 id="help-faq-title" className="section-title">
        Frequently asked questions
      </h2>
      <div className="field help-search">
        <label htmlFor="help-search">Search the FAQ</label>
        <input
          id="help-search"
          type="search"
          className="input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Try “Slack” or “pruned”"
        />
      </div>
      <p role="status" className="visually-hidden">
        {q ? `${matches.length} ${matches.length === 1 ? 'answer' : 'answers'} found` : ''}
      </p>
      {matches.length === 0 ? (
        <div className="banner stack help-empty">
          <p>No answers match “{query.trim()}”.</p>
          <p className="muted">Try a different word, or ask us with the support form below.</p>
          <div>
            <button type="button" className="btn btn-secondary" onClick={() => setQuery('')}>
              Clear search
            </button>
          </div>
        </div>
      ) : (
        <div className="help-topics">
          {FAQ_TOPICS.map((topic) => {
            const items = matches.filter((f) => f.topic === topic);
            if (items.length === 0) return null;
            const headingId = `help-topic-${topic.toLowerCase().replace(/[^a-z]+/g, '-')}`;
            return (
              <section key={topic} className="card help-topic" aria-labelledby={headingId}>
                <h3 id={headingId} className="card-section kicker">
                  {topic}
                </h3>
                {items.map((f) => (
                  <details key={f.id} className="card-section help-faq" open={q ? true : undefined}>
                    <summary>{f.question}</summary>
                    <p>{f.answer}</p>
                  </details>
                ))}
              </section>
            );
          })}
        </div>
      )}
    </section>
  );
}

const AREAS: { value: WrongAnswerReport['surface']; label: string }[] = [
  { value: 'brief', label: 'Evidence brief' },
  { value: 'gap', label: 'Gaps (what Rooted couldn’t find)' },
  { value: 'option', label: 'Options and scores' },
  { value: 'record', label: 'Decision record' },
  { value: 'other', label: 'Something else' },
];

function areaLabel(surface: WrongAnswerReport['surface']) {
  return AREAS.find((a) => a.value === surface)?.label ?? 'Something else';
}

function ReportSection() {
  const { state, dispatch } = useStore();
  const [decisionId, setDecisionId] = useState('');
  const [surface, setSurface] = useState<WrongAnswerReport['surface']>('brief');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!note.trim()) {
      setStatus('');
      setError('Tell us what Rooted got wrong.');
      return;
    }
    dispatch({
      type: 'addReport',
      report: {
        id: newId('r'),
        surface,
        decisionId: decisionId || undefined,
        note: note.trim(),
        createdAt: new Date().toISOString(),
      },
    });
    setError('');
    setNote('');
    setDecisionId('');
    setSurface('brief');
    setStatus('Report saved. It’s listed under “Your reports” below.');
  }

  return (
    <section className="card" aria-labelledby="help-report-title">
      <div className="card-section stack">
        <h2 id="help-report-title" className="section-title">
          Report a wrong answer
        </h2>
        <p className="muted">
          Rooted got something wrong in a brief, an option or a record? Tell us. You can also use “Report wrong
          answer” right next to any agent output.
        </p>
      </div>
      <form className="card-section stack" onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor="help-report-decision">Decision (optional)</label>
          <select
            id="help-report-decision"
            className="select"
            value={decisionId}
            onChange={(e) => setDecisionId(e.target.value)}
          >
            <option value="">Not about a specific decision</option>
            {state.decisions.map((d) => (
              <option key={d.id} value={d.id}>
                {d.question}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="help-report-area">Where was it?</label>
          <select
            id="help-report-area"
            className="select"
            value={surface}
            onChange={(e) => setSurface(e.target.value as WrongAnswerReport['surface'])}
          >
            {AREAS.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="help-report-note">What did Rooted get wrong?</label>
          <textarea
            id="help-report-note"
            className="textarea"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'help-report-error' : undefined}
            required
          />
          {error && (
            <p id="help-report-error" className="error" role="alert">
              {error}
            </p>
          )}
        </div>
        <div className="row">
          <button type="submit" className="btn">
            Send report
          </button>
        </div>
        <p role="status" className="help-status">
          {status}
        </p>
      </form>
    </section>
  );
}

const TOPICS = ['Getting started', 'Sources and privacy', 'Evidence brief', 'Options and logging', 'Account', 'Other'];

function SupportSection() {
  const [topic, setTopic] = useState(TOPICS[0]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const errorId = useId();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) {
      setSent(false);
      setError('Write a message so we know how to help.');
      return;
    }
    // Prototype: nothing leaves the browser and nothing is stored.
    setError('');
    setMessage('');
    setSent(true);
  }

  return (
    <section className="card" aria-labelledby="help-support-title">
      <div className="card-section stack">
        <h2 id="help-support-title" className="section-title">
          Contact support
        </h2>
        <p className="muted">Questions, bugs or ideas. In this prototype the form doesn’t send anything.</p>
      </div>
      <form className="card-section stack" onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor="help-support-topic">Topic</label>
          <select id="help-support-topic" className="select" value={topic} onChange={(e) => setTopic(e.target.value)}>
            {TOPICS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="help-support-message">Message</label>
          <textarea
            id="help-support-message"
            className="textarea"
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              setSent(false);
            }}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            required
          />
          {error && (
            <p id={errorId} className="error" role="alert">
              {error}
            </p>
          )}
        </div>
        <div className="row">
          <button type="submit" className="btn">
            Send message
          </button>
        </div>
        <p role="status" className="help-status">
          {sent ? 'Thanks. Prototype: nothing was sent.' : ''}
        </p>
      </form>
    </section>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function ReportsList() {
  const { state } = useStore();
  const reports = [...state.reports].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <section className="stack" aria-labelledby="help-reports-title">
      <h2 id="help-reports-title" className="section-title">
        Your reports
      </h2>
      {reports.length === 0 ? (
        <p className="muted">No reports yet. Anything you report, here or next to an agent output, shows up here.</p>
      ) : (
        <ul className="card help-reports">
          {reports.map((r) => {
            const decision = state.decisions.find((d) => d.id === r.decisionId);
            return (
              <li key={r.id} className="card-section stack help-report">
                <p className="row help-report-meta">
                  <time dateTime={r.createdAt} className="tabular">
                    {formatDate(r.createdAt)}
                  </time>
                  <span className="pill">{areaLabel(r.surface)}</span>
                </p>
                {decision ? (
                  <p className="help-report-decision">
                    <Link to={`/decisions/${decision.id}`}>{decision.question}</Link>
                  </p>
                ) : (
                  <p className="muted help-report-decision">Not about a specific decision</p>
                )}
                {r.excerpt && <blockquote className="help-report-excerpt">{r.excerpt}</blockquote>}
                <p>{r.note}</p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
