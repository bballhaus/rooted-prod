// F-04 (enter the decision) and F-05 (add your own context).
// /decisions/new creates a decision; /decisions/:id/frame edits one.
import { useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Stepper } from '../../components/Stepper';
import { newId, useDecision, useStore } from '../../store/store';
import type { Decision } from '../../types';
import './frame.css';

// Synthetic examples for a Growth PM at Fernwave.
export const EXAMPLE_DECISIONS = [
  'Should we gate SSO behind the Team plan?',
  'Extend the free trial from 14 to 21 days?',
  'Build in-app referrals now or after the dashboard redesign?',
];

// Local calendar date as YYYY-MM-DD, so "today" matches the PM's clock.
export function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

export function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === 'http:' || url.protocol === 'https:') && url.hostname.includes('.');
  } catch {
    return false;
  }
}

export function FramePage() {
  const { id } = useParams();
  const existing = useDecision(id);
  if (id && !existing) {
    return (
      <div className="page">
        <h1 className="page-title">Decision not found</h1>
        <p className="lead">
          We couldn&apos;t find a decision with that link. It may have been deleted with your data, or the link is
          incomplete.
        </p>
        <div className="row">
          <Link to="/" className="btn">
            Back to your decisions
          </Link>
          <Link to="/decisions/new" className="btn btn-secondary">
            Start a new decision
          </Link>
        </div>
      </div>
    );
  }
  // Keyed so switching between decisions resets the form.
  return <FrameForm key={existing?.id ?? 'new'} existing={existing} />;
}

function FrameForm({ existing }: { existing?: Decision }) {
  const { state, dispatch } = useStore();
  const navigate = useNavigate();
  const uid = useId();
  const defaultReviewDays = state.user?.defaultReviewDays ?? 30;

  const [question, setQuestion] = useState(existing?.question ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [links, setLinks] = useState<string[]>(existing?.links ?? []);
  const [linkDraft, setLinkDraft] = useState('');
  const [constraints, setConstraints] = useState<string[]>(existing?.constraints ?? []);
  const [constraintDraft, setConstraintDraft] = useState('');
  const [deadline, setDeadline] = useState(existing?.deadline ?? '');
  const [reviewDate, setReviewDate] = useState(
    existing ? (existing.reviewDate ?? '') : toIsoDate(addDays(new Date(), defaultReviewDays)),
  );

  const [questionError, setQuestionError] = useState('');
  const [linkError, setLinkError] = useState('');
  const [dateError, setDateError] = useState('');

  const questionRef = useRef<HTMLTextAreaElement>(null);
  const linkRef = useRef<HTMLInputElement>(null);
  const reviewRef = useRef<HTMLInputElement>(null);

  const ids = {
    question: `${uid}-question`,
    questionError: `${uid}-question-error`,
    notes: `${uid}-notes`,
    notesHint: `${uid}-notes-hint`,
    link: `${uid}-link`,
    linkError: `${uid}-link-error`,
    constraint: `${uid}-constraint`,
    deadline: `${uid}-deadline`,
    review: `${uid}-review`,
    reviewHint: `${uid}-review-hint`,
    dateError: `${uid}-date-error`,
  };

  // Returns the link list with the draft added, or null if the draft is invalid.
  function linksWithDraft(): string[] | null {
    const value = linkDraft.trim();
    if (!value) return links;
    if (!isValidUrl(value)) {
      setLinkError('Enter a full link that starts with https://, like https://docs.fernwave.example/sso-plan.');
      linkRef.current?.focus();
      return null;
    }
    setLinkError('');
    return links.includes(value) ? links : [...links, value];
  }

  function addLink() {
    const next = linksWithDraft();
    if (next === null) return;
    setLinks(next);
    setLinkDraft('');
    linkRef.current?.focus();
  }

  function addConstraint() {
    const value = constraintDraft.trim();
    if (!value) return;
    if (!constraints.includes(value)) setConstraints([...constraints, value]);
    setConstraintDraft('');
  }

  function onEnter(fn: () => void) {
    return (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        fn();
      }
    };
  }

  function pickExample(text: string) {
    setQuestion(text);
    setQuestionError('');
    questionRef.current?.focus();
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    const q = question.trim();
    if (!q) {
      setQuestionError('Write the decision you need to make, as a question.');
      questionRef.current?.focus();
      return;
    }
    setQuestionError('');

    if (deadline && reviewDate && reviewDate < deadline) {
      setDateError('Pick a review date on or after the deadline, so there is an outcome to record.');
      reviewRef.current?.focus();
      return;
    }
    setDateError('');

    const finalLinks = linksWithDraft();
    if (finalLinks === null) return;

    const fields = {
      question: q,
      notes: notes.trim(),
      links: finalLinks,
      constraints,
      deadline: deadline || undefined,
      reviewDate: reviewDate || undefined,
    };

    let decisionId: string;
    if (existing) {
      decisionId = existing.id;
      // Never move a decision backward: only a decision still being framed advances.
      const status = existing.status === 'framing' ? 'brief' : existing.status;
      dispatch({ type: 'updateDecision', decisionId, patch: { ...fields, status } });
    } else {
      decisionId = newId('d');
      dispatch({
        type: 'createDecision',
        decision: { id: decisionId, ...fields, status: 'brief', createdAt: new Date().toISOString() },
      });
    }
    navigate(`/decisions/${decisionId}/brief`);
  }

  return (
    <div className="page frame">
      {existing && <Stepper decision={existing} current="framing" />}
      <div className="stack">
        <h1 className="page-title">{existing ? 'Edit the decision' : 'Frame a decision'}</h1>
        <p className="lead">
          Write the call you need to make. Add anything Rooted can&apos;t see in Slack: notes, links and constraints.
          You make the decision; Rooted gathers the evidence.
        </p>
      </div>

      {!existing && (
        <section aria-labelledby={`${uid}-examples`} className="stack frame-examples">
          <h2 id={`${uid}-examples`} className="kicker">
            Start from an example
          </h2>
          <ul className="row frame-example-list">
            {EXAMPLE_DECISIONS.map((text) => (
              <li key={text}>
                <button type="button" className="frame-example" onClick={() => pickExample(text)}>
                  {text}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <form className="card frame-form" onSubmit={submit} noValidate>
        <section className="card-section stack" aria-labelledby={`${uid}-decision`}>
          <h2 id={`${uid}-decision`} className="section-title">
            The decision
          </h2>
          <div className="field">
            <label htmlFor={ids.question}>Decision question</label>
            <textarea
              id={ids.question}
              ref={questionRef}
              className="textarea frame-question"
              value={question}
              onChange={(e) => {
                setQuestion(e.target.value);
                if (questionError && e.target.value.trim()) setQuestionError('');
              }}
              placeholder="Should we gate SSO behind the Team plan?"
              aria-required="true"
              aria-invalid={questionError ? 'true' : undefined}
              aria-describedby={questionError ? ids.questionError : undefined}
              rows={2}
            />
            {questionError && (
              <p id={ids.questionError} role="alert" className="error frame-error">
                {questionError}
              </p>
            )}
          </div>
          <div className="grid-2">
            <div className="field">
              <label htmlFor={ids.deadline}>Deadline (optional)</label>
              <input
                id={ids.deadline}
                type="date"
                className="input"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
              <span className="hint">When you need to make the call.</span>
            </div>
            <div className="field">
              <label htmlFor={ids.review}>Review date</label>
              <input
                id={ids.review}
                ref={reviewRef}
                type="date"
                className="input"
                value={reviewDate}
                onChange={(e) => setReviewDate(e.target.value)}
                aria-invalid={dateError ? 'true' : undefined}
                aria-describedby={dateError ? `${ids.reviewHint} ${ids.dateError}` : ids.reviewHint}
              />
              <span id={ids.reviewHint} className="hint">
                When Rooted asks what happened.{' '}
                {existing ? (
                  <>
                    New decisions default to {defaultReviewDays} days out, set in <Link to="/settings">Settings</Link>.
                  </>
                ) : (
                  <>
                    Defaults to {defaultReviewDays} days from today, from your <Link to="/settings">Settings</Link>.
                  </>
                )}
              </span>
              {dateError && (
                <p id={ids.dateError} role="alert" className="error frame-error">
                  {dateError}
                </p>
              )}
            </div>
          </div>
        </section>

        <section className="card-section stack" aria-labelledby={`${uid}-context`}>
          <div className="stack frame-tight">
            <h2 id={`${uid}-context`} className="section-title">
              Your context
            </h2>
            <p className="muted frame-sub">Optional. Rooted adds this to the evidence brief next to what it finds.</p>
          </div>

          <div className="field">
            <label htmlFor={ids.notes}>Notes</label>
            <textarea
              id={ids.notes}
              className="textarea"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              aria-describedby={ids.notesHint}
              placeholder="Paste meeting notes, a customer quote or a metric. E.g. 4 of our last 10 lost enterprise deals asked for SSO on the Team plan."
            />
            <span id={ids.notesHint} className="hint">
              Paste anything Rooted can&apos;t find on its own.
            </span>
          </div>

          <div className="field">
            <label htmlFor={ids.link}>Links</label>
            <div className="frame-add">
              <input
                id={ids.link}
                ref={linkRef}
                type="url"
                inputMode="url"
                className="input"
                value={linkDraft}
                onChange={(e) => {
                  setLinkDraft(e.target.value);
                  if (linkError) setLinkError('');
                }}
                onKeyDown={onEnter(addLink)}
                placeholder="https://docs.fernwave.example/team-plan-prd"
                aria-invalid={linkError ? 'true' : undefined}
                aria-describedby={linkError ? ids.linkError : undefined}
              />
              <button type="button" className="btn btn-secondary" onClick={addLink}>
                Add link
              </button>
            </div>
            {linkError && (
              <p id={ids.linkError} role="alert" className="error frame-error">
                {linkError}
              </p>
            )}
            {links.length > 0 && (
              <ul className="frame-links" aria-label="Added links">
                {links.map((link) => (
                  <li key={link} className="frame-link">
                    <a href={link} target="_blank" rel="noreferrer" className="frame-link-text">
                      {link}
                    </a>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      aria-label={`Remove link ${link}`}
                      onClick={() => setLinks(links.filter((l) => l !== link))}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="field">
            <label htmlFor={ids.constraint}>Constraints</label>
            <div className="frame-add">
              <input
                id={ids.constraint}
                className="input"
                value={constraintDraft}
                onChange={(e) => setConstraintDraft(e.target.value)}
                onKeyDown={onEnter(addConstraint)}
                placeholder="No new eng headcount this quarter"
              />
              <button type="button" className="btn btn-secondary" onClick={addConstraint}>
                Add constraint
              </button>
            </div>
            {constraints.length > 0 && (
              <ul className="row frame-chips" aria-label="Added constraints">
                {constraints.map((c) => (
                  <li key={c} className="chip frame-chip">
                    <span>{c}</span>
                    <button
                      type="button"
                      className="frame-chip-remove"
                      aria-label={`Remove constraint ${c}`}
                      onClick={() => setConstraints(constraints.filter((x) => x !== c))}
                    >
                      <span aria-hidden="true">×</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <div className="card-section row frame-actions">
          <button type="submit" className="btn btn-lg">
            {existing ? 'Save and view the brief' : 'Gather evidence'}
          </button>
          <Link to={existing ? `/decisions/${existing.id}/brief` : '/'} className="btn btn-ghost">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
