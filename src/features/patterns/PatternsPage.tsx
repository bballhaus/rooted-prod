// F-R3-05 (decision 0019): patterns and trends. The top half is plain counting
// over the PM's own decisions and outcomes (store/patterns.ts): how many, how
// fast, how they turned out, by month and by goal. The bottom half is Rooted's
// (✦): patterns, trends, risks and predictions Claude found across the same
// decisions, each citing the decisions it rests on, each editable, dismissable
// and reportable (F-08, F-28). Rooted never says what to decide.
import { useId, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAi } from '../../agent/AiContext';
import { errorCode, type AiErrorCode } from '../../agent/client';
import { findPatterns, MIN_DECIDED_FOR_PATTERNS } from '../../agent/patterns';
import { AiErrorNotice } from '../../components/AiErrorNotice';
import { ReportWrongAnswer } from '../../components/ReportWrongAnswer';
import { isMine, localToday } from '../../store/dashboard';
import { decisionStats, patternDecisions, type DecisionStats } from '../../store/patterns';
import { useStore } from '../../store/store';
import type { Insight } from '../../types';
import { formatDate } from '../log/format';
import './patterns.css';

const KIND_LABEL: Record<Insight['kind'], string> = {
  pattern: 'Pattern',
  trend: 'Trend',
  prediction: 'Prediction',
  risk: 'Risk',
};

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function PatternsPage() {
  const { state, dispatch } = useStore();
  const ai = useAi();
  const navigate = useNavigate();
  const today = localToday();
  const [scope, setScope] = useState<'everyone' | 'mine'>('everyone');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AiErrorCode | null>(null);

  const decisions = useMemo(
    () => patternDecisions(state, scope === 'mine' ? (d) => isMine(d, state) : undefined),
    [state, scope],
  );
  const stats = useMemo(() => decisionStats(state, decisions, today), [state, decisions, today]);
  const shown = state.insights.filter((i) => !i.dismissed);
  const dismissed = state.insights.length - shown.length;
  const enough = stats.decided >= MIN_DECIDED_FOR_PATTERNS;

  async function look() {
    setError(null);
    if (!ai) {
      setError('not_configured');
      return;
    }
    // Who and which workspace this is for, so a late answer can't land somewhere else.
    const forUser = state.user?.authId ?? null;
    const demo = state.demo;
    setBusy(true);
    try {
      const insights = await findPatterns(ai, state, decisions, stats, today);
      dispatch({ type: 'setInsights', insights, forUser, demo });
    } catch (e) {
      setError(errorCode(e));
    } finally {
      setBusy(false);
    }
  }

  if (patternDecisions(state).length === 0) {
    return (
      <div className="page page-narrow patterns">
        <header className="stack">
          <h1 className="page-title">Patterns and trends</h1>
          <p className="lead">Once you’ve logged a few decisions, this is where you’ll see how they turn out and what’s likely next.</p>
        </header>
        <section className="card" aria-labelledby="patterns-empty">
          <div className="card-section stack">
            <h2 id="patterns-empty" className="section-title">
              No decisions yet
            </h2>
            <p className="muted">Frame and log a decision first, or explore the demo to see patterns across a sample team.</p>
            <p className="row">
              <Link to="/decisions/new" className="btn">
                Frame a decision
              </Link>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  dispatch({ type: 'loadDemo' });
                  navigate('/patterns');
                }}
              >
                Explore the demo
              </button>
            </p>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="page patterns">
      <header className="patterns-head">
        <div className="stack patterns-intro">
          <h1 className="page-title">Patterns and trends</h1>
          <p className="lead">How your decisions are going, and what Rooted sees coming.</p>
        </div>
        <div className="patterns-scope" role="group" aria-label="Whose decisions">
          <button type="button" className="toggle" aria-pressed={scope === 'everyone'} onClick={() => setScope('everyone')}>
            Everyone’s
          </button>
          <button type="button" className="toggle" aria-pressed={scope === 'mine'} onClick={() => setScope('mine')}>
            Just mine
          </button>
        </div>
      </header>

      <section className="patterns-section" aria-labelledby="patterns-numbers">
        <h2 id="patterns-numbers" className="patterns-h2">
          By the numbers
        </h2>
        <Numbers stats={stats} />
        <div className="patterns-pair">
          <MonthChart stats={stats} />
          <Goals stats={stats} />
        </div>
      </section>

      <section className="patterns-section" aria-labelledby="patterns-rooted">
        <div className="patterns-rooted-head">
          <div className="stack patterns-rooted-intro">
            <h2 id="patterns-rooted" className="patterns-h2 ai-mark">
              ✦ What Rooted sees
            </h2>
            <p className="patterns-text">
              Rooted reads these decisions, what was passed on and how each turned out, then points out patterns, trends,
              risks and what’s likely to come up next. It doesn’t decide anything for you.
            </p>
          </div>
          <button type="button" className="btn" disabled={busy || !enough} aria-describedby={enough ? undefined : 'patterns-min'} onClick={look}>
            {busy ? 'Reading your decisions…' : state.insights.length ? 'Look again' : 'Look for patterns'}
          </button>
        </div>
        {!enough && (
          <p id="patterns-min" className="patterns-text muted">
            Rooted needs at least {MIN_DECIDED_FOR_PATTERNS} logged decisions to look for patterns
            {scope === 'mine' ? ' of yours' : ''}; there {stats.decided === 1 ? 'is' : 'are'} {stats.decided} so far.
          </p>
        )}
        <div aria-live="polite">{error && <AiErrorNotice code={error} onRetry={look} />}</div>

        {shown.length > 0 ? (
          <>
            <p className="patterns-found muted">
              Found {formatDate(localToday(new Date(shown[shown.length - 1].foundAt)))}. Looking again replaces these, except the
              ones you edited.
            </p>
            <ul className="patterns-insights">
              {shown.map((i) => (
                <InsightCard key={i.id} insight={i} />
              ))}
            </ul>
          </>
        ) : (
          !busy &&
          !error &&
          enough && (
            <p className="patterns-empty">
              {dismissed ? `You dismissed everything Rooted found. Look again for a fresh read.` : 'Nothing yet. Ask Rooted to look.'}
            </p>
          )
        )}
      </section>
    </div>
  );
}

// The headline numbers: four stat tiles, each a count with what it's out of.
function Numbers({ stats }: { stats: DecisionStats }) {
  const o = stats.outcomes;
  const tiles = [
    { label: 'Decisions', value: String(stats.total), note: `${stats.decided} decided · ${stats.inProgress} in progress` },
    {
      label: 'Time to decide',
      value: stats.medianDaysToDecide === null ? '–' : plural(stats.medianDaysToDecide, 'day'),
      note: 'Median, from framing to logging',
    },
    {
      label: 'Outcomes logged',
      value: stats.reviewsDue ? `${stats.reviewsLogged} of ${stats.reviewsDue}` : '–',
      note: stats.reviewsDue
        ? stats.overdue
          ? `${plural(stats.overdue, 'review')} overdue`
          : 'Every review that came due'
        : 'No review dates have come yet',
    },
    {
      label: 'Worked',
      value: o.logged ? `${o.worked} of ${o.logged}` : '–',
      note: o.logged ? `${o.mixed} mixed · ${o['did-not-work']} didn’t work · ${o['too-early']} too early` : 'No outcomes logged yet',
    },
  ];
  return (
    <ul className="patterns-tiles">
      {tiles.map((t) => (
        <li key={t.label} className="card patterns-tile">
          <p className="patterns-tile-label">{t.label}</p>
          <p className="patterns-tile-value tabular">{t.value}</p>
          <p className="patterns-tile-note">{t.note}</p>
        </li>
      ))}
    </ul>
  );
}

// Decisions per month for the last six months: one series, so no legend; the
// title names it. A hidden table carries the same numbers for screen readers.
function MonthChart({ stats }: { stats: DecisionStats }) {
  const titleId = useId();
  const max = Math.max(1, ...stats.months.map((m) => m.count));
  const first = stats.months[0];
  const last = stats.months[stats.months.length - 1];
  const { recent, before } = stats.trendCounts;
  // The trend leaves out this month, which isn't over yet.
  const summary =
    stats.trend === null
      ? 'Too few decisions in the last six full months to call a direction.'
      : stats.trend === 'steady'
        ? `Steady: ${recent} in the last three full months, ${before} in the three before.`
        : `${stats.trend === 'up' ? 'Up' : 'Down'}: ${recent} in the last three full months, from ${before} in the three before.`;
  return (
    <figure className="card patterns-chart" aria-labelledby={titleId}>
      <div className="card-section stack">
        <figcaption className="stack patterns-chart-head">
          <h3 id={titleId} className="patterns-h3">
            Decisions per month
          </h3>
          <p className="patterns-text muted">{summary}</p>
        </figcaption>
        <div className="patterns-bars" aria-hidden="true">
          {stats.months.map((m) => (
            <div key={m.key} className="patterns-bar-col" data-tip={`${m.label} ${m.year}: ${plural(m.count, 'decision')}`}>
              <span className="patterns-bar-value tabular">{m.count}</span>
              <span className="patterns-bar" style={{ height: `${(m.count / max) * 100}%` }} />
              <span className="patterns-bar-label">{m === last ? `${m.label} (so far)` : m.label}</span>
            </div>
          ))}
        </div>
        <table className="visually-hidden">
          <caption>
            Decisions per month, {first.label} {first.year} to {last.label} {last.year}
          </caption>
          <thead>
            <tr>
              <th scope="col">Month</th>
              <th scope="col">Decisions</th>
            </tr>
          </thead>
          <tbody>
            {stats.months.map((m) => (
              <tr key={m.key}>
                <th scope="row">
                  {m.label} {m.year}
                  {m === last ? ' (so far)' : ''}
                </th>
                <td>{m.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}

// Each goal: how many decisions, how many logged outcomes, how many worked.
function Goals({ stats }: { stats: DecisionStats }) {
  const goals = stats.goals.slice(0, 6);
  return (
    <section className="card patterns-goals" aria-labelledby="patterns-goals">
      <div className="card-section stack">
        <h3 id="patterns-goals" className="patterns-h3">
          By goal
        </h3>
        {goals.length === 0 ? (
          <p className="patterns-text muted">Give decisions a goal or a tag to see them grouped here.</p>
        ) : (
          <table className="patterns-table">
            <thead>
              <tr>
                <th scope="col">Goal</th>
                <th scope="col">Decisions</th>
                <th scope="col">Outcomes</th>
                <th scope="col">Worked</th>
              </tr>
            </thead>
            <tbody>
              {goals.map((g) => (
                <tr key={g.goal}>
                  <th scope="row">{g.goal}</th>
                  <td className="tabular">{g.count}</td>
                  <td className="tabular">{g.logged}</td>
                  <td className="tabular">{g.logged ? `${g.worked} of ${g.logged}` : '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

function InsightCard({ insight }: { insight: Insight }) {
  const { state, dispatch } = useStore();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(insight.title);
  const [detail, setDetail] = useState(insight.detail);
  const ids = { title: useId(), detail: useId() };
  const cited = insight.decisionIds.map((id) => state.decisions.find((d) => d.id === id)).filter((d) => !!d);

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    dispatch({ type: 'updateInsight', insightId: insight.id, patch: { title: title.trim(), detail: detail.trim(), userEdited: true } });
    setEditing(false);
  }

  return (
    <li className={`patterns-insight patterns-insight-${insight.kind}`}>
      <p className="patterns-insight-kind">
        <span className="ai-mark">✦ {KIND_LABEL[insight.kind]}</span>
        {insight.confidence && <span className="muted"> · {insight.confidence} confidence</span>}
        {insight.userEdited && <span className="muted"> · edited by you</span>}
      </p>
      {editing ? (
        <form className="stack patterns-edit" onSubmit={save}>
          <div className="field">
            <label htmlFor={ids.title}>Insight</label>
            <input id={ids.title} className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor={ids.detail}>Details</label>
            <textarea id={ids.detail} className="textarea" value={detail} onChange={(e) => setDetail(e.target.value)} />
          </div>
          <div className="row">
            <button type="submit" className="btn btn-secondary">
              Save
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setTitle(insight.title);
                setDetail(insight.detail);
                setEditing(false);
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <>
          <p className="patterns-insight-title">{insight.title}</p>
          {insight.detail && <p className="patterns-text">{insight.detail}</p>}
          {insight.watchFor && (
            <p className="patterns-text">
              <strong>Watch for:</strong> {insight.watchFor}
            </p>
          )}
        </>
      )}
      {cited.length > 0 && (
        <div className="patterns-cited">
          <p className="patterns-cited-label">Based on</p>
          <ul className="patterns-cited-list">
            {cited.map((d) => (
              <li key={d.id}>
                <Link to={`/?focus=${d.id}`} className="patterns-cited-link">
                  {d.question}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      {!editing && (
        <div className="row patterns-insight-actions">
          <button type="button" className="btn btn-ghost" onClick={() => setEditing(true)}>
            Edit
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => dispatch({ type: 'updateInsight', insightId: insight.id, patch: { dismissed: true } })}
          >
            Dismiss
          </button>
          <ReportWrongAnswer surface="insight" targetId={insight.id} excerpt={insight.title} />
        </div>
      )}
    </li>
  );
}
