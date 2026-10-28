// F-06 to F-09: the co-created evidence brief. The agent gathers context from
// allowed sources; the PM searches it, marks items wrong, edits, removes and
// restores them, answers the gaps the agent flagged, and adds their own context.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { describeSourceAccess, gatherBrief, gatherSteps } from '../../agent/brief';
import { AGENT_DELAY_MS } from '../../agent/mockAgent';
import { Dialog } from '../../components/Dialog';
import { ReportWrongAnswer } from '../../components/ReportWrongAnswer';
import { Stepper } from '../../components/Stepper';
import { newId, useDecision, useStore } from '../../store/store';
import type { ContextItem, ContextOrigin, Decision, Gap } from '../../types';
import './brief.css';

const ORIGIN_LABELS: Record<ContextOrigin, string> = {
  slack: 'Slack',
  drive: 'Google Drive',
  'past-decision': 'Past decisions',
  'user-note': 'Your notes',
};

function useGather(decision: Decision | undefined) {
  const { state, dispatch } = useStore();
  const [gathering, setGathering] = useState(false);
  const [step, setStep] = useState('');
  const started = useRef<string | null>(null);

  function run() {
    if (!decision) return;
    const steps = gatherSteps(state);
    setGathering(true);
    setStep(steps[0]);
    let i = 0;
    const timer = setInterval(() => {
      i = Math.min(i + 1, steps.length - 1);
      setStep(steps[i]);
    }, Math.max(80, Math.floor(AGENT_DELAY_MS / steps.length)));
    void gatherBrief(decision, state).then(({ items, gaps }) => {
      clearInterval(timer);
      dispatch({ type: 'setBrief', decisionId: decision.id, items, gaps });
      if (decision.status === 'framing') {
        dispatch({ type: 'updateDecision', decisionId: decision.id, patch: { status: 'brief' } });
      }
      setGathering(false);
      setStep('');
    });
  }

  const hasItems = !!decision && state.contextItems.some((c) => c.decisionId === decision.id);
  useEffect(() => {
    if (!decision || hasItems || started.current === decision.id) return;
    started.current = decision.id;
    run();
    // Runs once when a decision with no brief is first shown.
  }, [decision?.id, hasItems]);

  return { gathering, step, regather: run };
}

export function BriefPage() {
  const { id } = useParams();
  const decision = useDecision(id);
  const { gathering, step, regather } = useGather(decision);

  if (!decision) {
    return (
      <div className="page">
        <h1 className="page-title">Decision not found</h1>
        <p className="lead">There's no decision with that link. It may have been deleted with your data.</p>
        <p>
          <Link to="/" className="btn btn-secondary">
            Back to decisions
          </Link>
        </p>
      </div>
    );
  }

  return <Brief decision={decision} gathering={gathering} step={step} regather={regather} />;
}

function Brief({
  decision,
  gathering,
  step,
  regather,
}: {
  decision: Decision;
  gathering: boolean;
  step: string;
  regather: () => void;
}) {
  const { state, dispatch } = useStore();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<string | null>(null);
  const [origin, setOrigin] = useState<ContextOrigin | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const all = state.contextItems.filter((c) => c.decisionId === decision.id);
  const live = all.filter((c) => !c.removed);
  const removed = all.filter((c) => c.removed);
  const gaps = state.gaps.filter((g) => g.decisionId === decision.id);
  const access = useMemo(() => describeSourceAccess(state), [state]);

  const groups = [...new Set(live.map((c) => c.group))];
  const origins = [...new Set(live.map((c) => c.origin))];
  const q = query.trim().toLowerCase();
  const visible = live.filter(
    (c) =>
      (!group || c.group === group) &&
      (!origin || c.origin === origin) &&
      (!q || [c.snippet, c.sourceLabel, c.author ?? '', c.group].some((t) => t.toLowerCase().includes(q))),
  );
  const visibleGroups = groups.filter((g) => visible.some((c) => c.group === g));

  function continueToOptions() {
    if (decision.status !== 'decided' && decision.status !== 'options') {
      dispatch({ type: 'updateDecision', decisionId: decision.id, patch: { status: 'options' } });
    }
    navigate(`/decisions/${decision.id}/options`);
  }

  return (
    <div className="page brief">
      <Stepper decision={decision} current="brief" />
      <header className="stack">
        <p className="kicker">Evidence brief</p>
        <h1 className="page-title">{decision.question}</h1>
        <p className="lead">
          Here's what Rooted found. Fix anything that's wrong, remove what doesn't matter, and fill the gaps before
          you weigh options.
        </p>
      </header>

      <section aria-labelledby="brief-sources-title" className="brief-sources banner">
        <h2 id="brief-sources-title" className="brief-subtitle">
          Sources
        </h2>
        <p>
          <strong>Read:</strong> {access.read.join(', ')}
        </p>
        {access.excluded.length > 0 && (
          <p>
            <strong>Not read:</strong>{' '}
            {access.excluded.map((e) => `${e.label} (${e.reason})`).join(', ')}.{' '}
            <Link to="/settings">Change access in settings</Link>
          </p>
        )}
      </section>

      {gathering ? (
        <div className="brief-gathering card card-section" role="status" aria-live="polite">
          <span className="spinner" aria-hidden="true" />
          <span>{step || 'Gathering context…'}</span>
        </div>
      ) : (
        <>
          {gaps.length > 0 && <GapsCallout gaps={gaps} decisionId={decision.id} />}

          <section aria-labelledby="brief-items-title" className="stack">
            <div className="brief-toolbar">
              <h2 id="brief-items-title" className="section-title">
                Context <span className="muted tabular">({live.length})</span>
              </h2>
              <div className="field brief-search">
                <label htmlFor="brief-search">Search the brief</label>
                <input
                  id="brief-search"
                  type="search"
                  className="input"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Try “trial” or “#growth”"
                />
              </div>
            </div>

            <div className="brief-filters" role="group" aria-label="Filter by theme">
              <button type="button" className="toggle" aria-pressed={group === null} onClick={() => setGroup(null)}>
                All themes
              </button>
              {groups.map((g) => (
                <button
                  key={g}
                  type="button"
                  className="toggle"
                  aria-pressed={group === g}
                  onClick={() => setGroup(group === g ? null : g)}
                >
                  {g}
                </button>
              ))}
            </div>
            <div className="brief-filters" role="group" aria-label="Filter by source">
              <button type="button" className="toggle" aria-pressed={origin === null} onClick={() => setOrigin(null)}>
                All sources
              </button>
              {origins.map((o) => (
                <button
                  key={o}
                  type="button"
                  className="toggle"
                  aria-pressed={origin === o}
                  onClick={() => setOrigin(origin === o ? null : o)}
                >
                  {ORIGIN_LABELS[o]}
                </button>
              ))}
            </div>

            <p className="visually-hidden" role="status" aria-live="polite">
              {visible.length} of {live.length} items shown
            </p>

            {live.length === 0 ? (
              <p className="banner">Nothing left in the brief. Restore an item below or add your own context.</p>
            ) : visible.length === 0 ? (
              <p className="banner">No context matches those filters.</p>
            ) : (
              visibleGroups.map((g) => (
                <section key={g} className="stack brief-group" aria-label={g}>
                  <h3 className="brief-subtitle">{g}</h3>
                  {visible
                    .filter((c) => c.group === g)
                    .map((c) => (
                      <ContextCard key={c.id} item={c} />
                    ))}
                </section>
              ))
            )}
          </section>

          {removed.length > 0 && (
            <details className="brief-removed card card-section">
              <summary>Removed ({removed.length})</summary>
              <ul className="stack brief-removed-list">
                {removed.map((c) => (
                  <li key={c.id} className="row brief-removed-item">
                    <span>
                      <strong>{c.sourceLabel}</strong>: {c.snippet}
                    </span>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => dispatch({ type: 'updateContextItem', itemId: c.id, patch: { removed: false } })}
                      aria-label={`Restore ${c.sourceLabel}: ${c.snippet.slice(0, 40)}`}
                    >
                      Restore
                    </button>
                  </li>
                ))}
              </ul>
            </details>
          )}

          <AddContextForm decisionId={decision.id} />
        </>
      )}

      <div className="row brief-actions">
        <button type="button" className="btn btn-lg" onClick={continueToOptions} disabled={gathering}>
          Looks right, show options
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => setConfirmOpen(true)}
          disabled={gathering}
        >
          Gather again
        </button>
      </div>

      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} title="Gather context again?">
        <p>
          Rooted will read your allowed sources again and replace this brief. Your edits, removed items, notes you
          added and gap answers will be replaced.
        </p>
        <div className="row">
          <button
            type="button"
            className="btn"
            onClick={() => {
              setConfirmOpen(false);
              regather();
            }}
          >
            Replace the brief
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => setConfirmOpen(false)}>
            Keep this brief
          </button>
        </div>
      </Dialog>
    </div>
  );
}

function ContextCard({ item }: { item: ContextItem }) {
  const { dispatch } = useStore();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.snippet);
  const textId = `brief-edit-${item.id}`;
  const titleId = `brief-item-${item.id}`;

  function save(e: React.FormEvent) {
    e.preventDefault();
    const next = draft.trim();
    if (!next) return;
    if (next !== item.snippet) {
      dispatch({ type: 'updateContextItem', itemId: item.id, patch: { snippet: next, userEdited: true } });
    }
    setEditing(false);
  }

  return (
    <article
      className={`card card-section brief-item${item.flaggedInaccurate ? ' brief-item-flagged' : ''}`}
      aria-labelledby={titleId}
    >
      <div className="brief-item-meta">
        <h4 id={titleId} className="brief-item-source">
          {item.link && item.origin === 'past-decision' ? <Link to={item.link}>{item.sourceLabel}</Link> : item.sourceLabel}
        </h4>
        <span className="muted">
          {item.author ? `${item.author} · ` : ''}
          <time dateTime={item.date}>{item.date}</time>
        </span>
        <span className="pill">{ORIGIN_LABELS[item.origin]}</span>
        {item.flaggedInaccurate && <span className="pill brief-flag">Marked wrong</span>}
        {item.userEdited && <span className="pill">Edited by you</span>}
      </div>

      {editing ? (
        <form className="stack" onSubmit={save}>
          <div className="field">
            <label htmlFor={textId}>Edit this context</label>
            <textarea id={textId} className="textarea" value={draft} onChange={(e) => setDraft(e.target.value)} />
          </div>
          <div className="row">
            <button type="submit" className="btn" disabled={!draft.trim()}>
              Save edit
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setDraft(item.snippet);
                setEditing(false);
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <p className={`brief-snippet${item.flaggedInaccurate ? ' brief-snippet-flagged' : ''}`}>
          {item.link && item.origin === 'user-note' ? (
            <a href={item.link} target="_blank" rel="noreferrer">
              {item.snippet}
            </a>
          ) : (
            item.snippet
          )}
        </p>
      )}

      {!editing && (
        <div className="row brief-item-actions">
          <button
            type="button"
            className="toggle"
            aria-pressed={item.flaggedInaccurate}
            onClick={() =>
              dispatch({
                type: 'updateContextItem',
                itemId: item.id,
                patch: { flaggedInaccurate: !item.flaggedInaccurate },
              })
            }
          >
            Mark wrong
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              setDraft(item.snippet);
              setEditing(true);
            }}
          >
            Edit
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => dispatch({ type: 'updateContextItem', itemId: item.id, patch: { removed: true } })}
          >
            Remove
          </button>
          <ReportWrongAnswer surface="brief" targetId={item.id} decisionId={item.decisionId} excerpt={item.snippet} />
        </div>
      )}
    </article>
  );
}

function GapsCallout({ gaps, decisionId }: { gaps: Gap[]; decisionId: string }) {
  return (
    <section aria-labelledby="brief-gaps-title" className="card brief-gaps">
      <div className="card-section stack">
        <h2 id="brief-gaps-title" className="section-title">
          What Rooted couldn't find
        </h2>
        <p className="muted">Answer what you know. Your answers go into the brief the options are built from.</p>
      </div>
      {gaps.map((g) => (
        <GapRow key={g.id} gap={g} decisionId={decisionId} />
      ))}
    </section>
  );
}

function GapRow({ gap, decisionId }: { gap: Gap; decisionId: string }) {
  const { dispatch } = useStore();
  const [editing, setEditing] = useState(!gap.answer);
  const [draft, setDraft] = useState(gap.answer ?? '');
  const inputId = `brief-gap-${gap.id}`;

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    dispatch({ type: 'updateGap', gapId: gap.id, patch: { answer: draft.trim() } });
    setEditing(false);
  }

  return (
    <div className="card-section stack brief-gap">
      <p className="brief-gap-question" id={`${inputId}-q`}>
        {gap.question}
      </p>
      {editing ? (
        <form className="stack" onSubmit={save}>
          <div className="field">
            <label htmlFor={inputId} className="visually-hidden">
              Your answer to: {gap.question}
            </label>
            <textarea
              id={inputId}
              className="textarea brief-gap-input"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Your answer"
            />
          </div>
          <div className="row">
            <button type="submit" className="btn btn-secondary" disabled={!draft.trim()}>
              Save answer
            </button>
            <ReportWrongAnswer surface="gap" targetId={gap.id} decisionId={decisionId} excerpt={gap.question} />
          </div>
        </form>
      ) : (
        <div className="row">
          <p className="brief-gap-answer">
            <span className="muted">Your answer:</span> {gap.answer}
          </p>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              setDraft(gap.answer ?? '');
              setEditing(true);
            }}
            aria-label={`Edit your answer to: ${gap.question}`}
          >
            Edit answer
          </button>
          <ReportWrongAnswer surface="gap" targetId={gap.id} decisionId={decisionId} excerpt={gap.question} />
        </div>
      )}
    </div>
  );
}

function AddContextForm({ decisionId }: { decisionId: string }) {
  const { state, dispatch } = useStore();
  const [text, setText] = useState('');
  const [label, setLabel] = useState('');
  const [link, setLink] = useState('');
  const [added, setAdded] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    dispatch({
      type: 'addContextItem',
      item: {
        id: newId('c'),
        decisionId,
        origin: 'user-note',
        sourceLabel: label.trim() || 'Your note',
        author: state.user?.name,
        date: new Date().toISOString().slice(0, 10),
        snippet: text.trim(),
        link: link.trim() || undefined,
        group: 'Your notes',
        flaggedInaccurate: false,
        userEdited: false,
        removed: false,
      },
    });
    setText('');
    setLabel('');
    setLink('');
    setAdded(true);
  }

  return (
    <section aria-labelledby="brief-add-title" className="card card-section stack">
      <h2 id="brief-add-title" className="section-title">
        Add your own context
      </h2>
      <form className="stack" onSubmit={submit}>
        <div className="field">
          <label htmlFor="brief-add-text">What should Rooted know?</label>
          <textarea
            id="brief-add-text"
            className="textarea"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setAdded(false);
            }}
            placeholder="e.g. Finance wants any trial change reviewed before December."
          />
        </div>
        <div className="grid-2">
          <div className="field">
            <label htmlFor="brief-add-label">Where it's from (optional)</label>
            <input
              id="brief-add-label"
              className="input"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="1:1 with Rafael"
            />
          </div>
          <div className="field">
            <label htmlFor="brief-add-link">Link (optional)</label>
            <input
              id="brief-add-link"
              className="input"
              type="url"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://"
            />
          </div>
        </div>
        <div className="row">
          <button type="submit" className="btn btn-secondary" disabled={!text.trim()}>
            Add to brief
          </button>
          <span role="status" className="muted">
            {added ? 'Added to “Your notes”.' : ''}
          </span>
        </div>
      </form>
    </section>
  );
}
