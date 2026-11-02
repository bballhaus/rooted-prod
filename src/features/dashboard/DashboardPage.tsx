// F-17, F-19: home. Above the fold: what needs the PM (outcomes due, deadlines,
// decisions Rooted spotted, drafts) and the decision map. The map is a graph
// you can drag and trace (0010), or a timeline in lanes by tag, owner, team or
// status; it can be colored, filtered, and searched from the header. Picking a
// decision opens its details beside the map.
import { useEffect, useId, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { rankDecisions } from '../../agent/chat';
import { Avatar, personColor } from '../../components/Avatar';
import { IconGraph, IconSidebar, IconTimeline, IconTrace } from '../../components/icons';
import { ReportWrongAnswer } from '../../components/ReportWrongAnswer';
import {
  chosenLabel,
  decisionDate,
  inboxItems,
  isMine,
  localToday,
  MAP_STATUS_LABEL,
  mapStatus,
  ownerOf,
  workspaceTags,
  type MapStatus,
} from '../../store/dashboard';
import { useStore } from '../../store/store';
import type { AppState, Decision } from '../../types';
import { useAgent } from '../agent/AgentContext';
import { continuePath, formatDate } from '../log/format';
import { DecisionDetail } from './DecisionDetail';
import { DecisionMap, goalPalette, type ColorBy, type MapLayoutMode } from './DecisionMap';
import { InboxRow } from './InboxRow';
import { LANE_LABEL, laneOf, type LaneBy } from './mapLayout';
import { useInboxActions } from './useInboxActions';
import './dashboard.css';

type View = 'tree' | 'list';
type StatusFilter = 'all' | MapStatus;

const VIEW_KEY = 'rooted-map-view';

function initialView(): View {
  try {
    const saved = localStorage.getItem(VIEW_KEY);
    if (saved === 'tree' || saved === 'list') return saved;
  } catch {
    // storage can be unavailable
  }
  // A graph doesn't fit a phone; start small screens on the list.
  return typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 880px)').matches ? 'list' : 'tree';
}

export function searchMatches(q: string, state: AppState): Set<string> | null {
  const query = q.trim().toLowerCase();
  if (!query) return null;
  const ranked = rankDecisions(query, state).map((d) => d.id);
  const literal = state.decisions.filter((d) => d.question.toLowerCase().includes(query)).map((d) => d.id);
  return new Set([...ranked, ...literal]);
}

export function DashboardPage() {
  const { state } = useStore();
  const { highlight } = useAgent();
  const [params, setParams] = useSearchParams();
  const today = localToday();
  const ids = { lanes: useId(), who: useId(), tag: useId(), status: useId(), color: useId() };

  const [view, setView] = useState<View>(initialView);
  const [mode, setMode] = useState<MapLayoutMode>('graph');
  const [colorBy, setColorBy] = useState<ColorBy>('status');
  const [trace, setTrace] = useState(false);
  const [railOpen, setRailOpen] = useState(true);
  const [laneBy, setLaneBy] = useState<LaneBy>('thread');
  const [who, setWho] = useState<string>('everyone');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [tag, setTag] = useState<string>('');

  useEffect(() => {
    try {
      localStorage.setItem(VIEW_KEY, view);
    } catch {
      // the view just won't be remembered
    }
  }, [view]);

  const q = params.get('q') ?? '';
  const selectedId = params.get('focus') ?? undefined;
  const matchIds = useMemo(() => searchMatches(q, state), [q, state]);
  const tags = workspaceTags(state);

  const filtered = state.decisions.filter((d) => {
    if (who === 'me' && !isMine(d, state)) return false;
    if (who !== 'everyone' && who !== 'me' && ownerOf(d, state)?.id !== who) return false;
    if (status !== 'all' && mapStatus(d, state, today) !== status) return false;
    if (tag && !d.tags?.some((t) => t.label === tag)) return false;
    return true;
  });
  // The list hides what search doesn't match; the map dims it so the thread stays visible.
  const listed = matchIds ? filtered.filter((d) => matchIds.has(d.id)) : filtered;
  const selected = state.decisions.find((d) => d.id === selectedId);

  function select(id: string | undefined) {
    const next = new URLSearchParams(params);
    if (id) next.set('focus', id);
    else next.delete('focus');
    setParams(next, { replace: true });
  }

  const dueCount = state.decisions.filter((d) => isMine(d, state) && mapStatus(d, state, today) === 'outcome-due').length;

  return (
    <div className={railOpen ? 'dash' : 'dash dash-rail-hidden'}>
      {railOpen && <NeedsYou today={today} />}

      <section className="dash-main" aria-labelledby="dash-title">
        <div className="dash-toolbar">
          <div className="dash-heading">
            <h1 id="dash-title" className="dash-title">
              Decisions
            </h1>
            <p className="muted dash-count tabular" role="status">
              {matchIds ? `${listed.length} match “${q}” · ` : ''}
              {filtered.length} shown · {state.decisions.length} total
              {dueCount ? ` · ${dueCount} outcome${dueCount === 1 ? '' : 's'} due` : ''}
            </p>
          </div>

          <div className="row dash-controls">
            <button
              type="button"
              className="icon-btn dash-rail-btn"
              aria-label={railOpen ? 'Hide the Needs you panel' : 'Show the Needs you panel'}
              aria-pressed={!railOpen}
              onClick={() => setRailOpen(!railOpen)}
            >
              <IconSidebar size={18} />
            </button>
            <div className="dash-seg" role="group" aria-label="View">
              <button type="button" className="toggle" aria-pressed={view === 'tree'} onClick={() => setView('tree')}>
                Tree
              </button>
              <button type="button" className="toggle" aria-pressed={view === 'list'} onClick={() => setView('list')}>
                List
              </button>
            </div>
            {view === 'tree' && (
              <div className="dash-seg" role="group" aria-label="Map layout">
                <button type="button" className="toggle" aria-pressed={mode === 'graph'} onClick={() => setMode('graph')}>
                  <IconGraph size={15} /> Graph
                </button>
                <button
                  type="button"
                  className="toggle"
                  aria-pressed={mode === 'timeline'}
                  onClick={() => setMode('timeline')}
                >
                  <IconTimeline size={15} /> Timeline
                </button>
              </div>
            )}
            {(view === 'list' || mode === 'timeline') && (
              <div className="field dash-field">
                <label htmlFor={ids.lanes}>{view === 'tree' ? 'Lanes' : 'Group by'}</label>
                <select id={ids.lanes} className="select" value={laneBy} onChange={(e) => setLaneBy(e.target.value as LaneBy)}>
                  {(Object.keys(LANE_LABEL) as LaneBy[]).map((k) => (
                    <option key={k} value={k}>
                      {LANE_LABEL[k]}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {view === 'tree' && (
              <div className="field dash-field">
                <label htmlFor={ids.color}>Color by</label>
                <select id={ids.color} className="select" value={colorBy} onChange={(e) => setColorBy(e.target.value as ColorBy)}>
                  <option value="status">Status</option>
                  <option value="goal">Goal or tag</option>
                  <option value="owner">Who decided</option>
                </select>
              </div>
            )}
            {view === 'tree' && (
              <button
                type="button"
                className="toggle dash-trace"
                aria-pressed={trace && !!selected}
                disabled={!selected}
                title={selected ? 'Highlight everything this decision built on and led to' : 'Pick a decision to trace it'}
                onClick={() => setTrace(!trace)}
              >
                <IconTrace size={15} /> Trace
              </button>
            )}
            <div className="field dash-field">
              <label htmlFor={ids.who}>Who</label>
              <select id={ids.who} className="select" value={who} onChange={(e) => setWho(e.target.value)}>
                <option value="everyone">Everyone</option>
                <option value="me">Just me</option>
                {state.teammates
                  .filter((t) => t.id !== state.user?.id)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
              </select>
            </div>
            <div className="field dash-field">
              <label htmlFor={ids.tag}>Tag</label>
              <select id={ids.tag} className="select" value={tag} onChange={(e) => setTag(e.target.value)}>
                <option value="">All tags</option>
                {tags.map((t) => (
                  <option key={t} value={t}>
                    #{t}
                  </option>
                ))}
              </select>
            </div>

            <div className="field dash-field">
              <label htmlFor={ids.status}>Status</label>
              <select
                id={ids.status}
                className="select"
                value={status}
                onChange={(e) => setStatus(e.target.value as StatusFilter)}
              >
                {(['all', 'open', 'outcome-due', 'decided', 'outcome-logged'] as StatusFilter[]).map((s) => (
                  <option key={s} value={s}>
                    {s === 'all' ? 'Any status' : MAP_STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
            </div>
            {view === 'tree' && <Legend />}
            {view === 'tree' && colorBy !== 'status' && <ColorLegend decisions={filtered} colorBy={colorBy} />}
          </div>
        </div>

        <div className={selected ? 'dash-stage dash-stage-detail' : 'dash-stage'}>
          {state.decisions.length === 0 ? (
            <EmptyState />
          ) : filtered.length === 0 ? (
            <p className="banner dash-empty">No decisions match those filters.</p>
          ) : view === 'tree' ? (
            <DecisionMap
              state={state}
              decisions={filtered}
              mode={mode}
              laneBy={laneBy}
              colorBy={colorBy}
              trace={trace}
              positionsKey={`${state.demo ? 'demo' : 'own'}:${who}`}
              today={today}
              selectedId={selectedId}
              matchIds={matchIds}
              highlightIds={highlight}
              onSelect={select}
            />
          ) : (
            <DecisionList decisions={listed} laneBy={laneBy} today={today} selectedId={selectedId} onSelect={select} />
          )}
          {selected && <DecisionDetail key={selected.id} decision={selected} today={today} onClose={() => select(undefined)} />}
        </div>
      </section>
    </div>
  );
}

function Legend() {
  return (
    <p className="row dash-legend muted" aria-label="Legend">
      <span className="row dash-legend-item">
        <svg width="28" height="8" aria-hidden="true">
          <line x1="0" y1="4" x2="28" y2="4" stroke="var(--ink2)" strokeWidth="1.6" />
        </svg>
        Linked by your team
      </span>
      <span className="row dash-legend-item ai-mark">
        <svg width="28" height="8" aria-hidden="true">
          <line x1="0" y1="4" x2="28" y2="4" stroke="var(--ai-line)" strokeWidth="1.6" strokeDasharray="6 5" />
        </svg>
        ✦ Found by Rooted
      </span>
      <span className="row dash-legend-item">
        <span className="tag">#yours</span>
        <span className="tag tag-ai">✦ #suggested</span>
      </span>
    </p>
  );
}

// What each stripe color means when the map is colored by goal or by person.
function ColorLegend({ decisions, colorBy }: { decisions: Decision[]; colorBy: ColorBy }) {
  const { state } = useStore();
  const items =
    colorBy === 'goal'
      ? goalPalette(decisions).legend.map((g) => ({ key: g.label, ...g }))
      : [...new Set(decisions.map((d) => ownerOf(d, state)?.id))].map((id) => {
          const mate = state.teammates.find((t) => t.id === id);
          return { key: id ?? 'unknown', label: mate?.name ?? 'Unknown', color: personColor(id, state.teammates) };
        });
  return (
    <ul className="row dash-legend dash-color-legend muted" aria-label={colorBy === 'goal' ? 'Goals' : 'People'}>
      {items.map((i) => (
        <li key={i.key} className="row dash-legend-item">
          <span className="dash-swatch" style={{ background: i.color }} aria-hidden="true" />
          {i.label}
        </li>
      ))}
    </ul>
  );
}

function EmptyState() {
  const { dispatch } = useStore();
  const navigate = useNavigate();
  return (
    <section className="card dash-empty" aria-labelledby="decisions-empty">
      <div className="card-section stack">
        <h2 id="decisions-empty" className="section-title">
          Start with one decision.
        </h2>
        <p className="muted">
          Pick a call you're weighing this week, like a pricing change or what to cut from the sprint. Frame the question
          and Rooted gathers the context from Slack.
        </p>
        <p>
          <Link to="/decisions/new" className="btn">
            Frame your first decision
          </Link>{' '}
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              dispatch({ type: 'loadDemo' });
              navigate('/');
            }}
          >
            Explore the demo
          </button>
        </p>
      </div>
    </section>
  );
}

function DecisionList({
  decisions,
  laneBy,
  today,
  selectedId,
  onSelect,
}: {
  decisions: Decision[];
  laneBy: LaneBy;
  today: string;
  selectedId?: string;
  onSelect: (id: string) => void;
}) {
  const { state } = useStore();
  if (decisions.length === 0) return <p className="banner dash-empty">No decisions match.</p>;
  const groups = new Map<string, Decision[]>();
  for (const d of [...decisions].sort((a, b) => decisionDate(b).localeCompare(decisionDate(a)))) {
    const key = laneOf(d, laneBy, state, today);
    groups.set(key, [...(groups.get(key) ?? []), d]);
  }
  return (
    <div className="dash-list">
      {[...groups].map(([key, items]) => (
        <section key={key} className="stack dash-list-group" aria-label={key}>
          {laneBy !== 'none' && <h2 className="kicker">{laneBy === 'tag' ? `#${key}` : key}</h2>}
          <ul className="dash-list-items">
            {items.map((d) => {
              const s = mapStatus(d, state, today);
              const owner = ownerOf(d, state);
              const chosen = chosenLabel(d, state);
              return (
                <li key={d.id}>
                  <button
                    type="button"
                    className={d.id === selectedId ? 'dash-row dash-row-selected' : 'dash-row'}
                    aria-pressed={d.id === selectedId}
                    onClick={() => onSelect(d.id)}
                  >
                    <Avatar person={owner} teammates={state.teammates} />
                    <span className="dash-row-text">
                      <span className="dash-row-q">{d.question}</span>
                      <span className="row dash-row-meta">
                        <span className={s === 'outcome-due' ? 'due-label' : 'muted'}>{MAP_STATUS_LABEL[s]}</span>
                        {chosen && (
                          <span className="row dash-row-chosen">
                            <span className="dot dot-chosen" aria-hidden="true" />
                            <span className="visually-hidden">Chose: </span>
                            {chosen}
                          </span>
                        )}
                        <span className="muted">
                          {owner?.name ?? 'Unknown'} · {formatDate(decisionDate(d))}
                        </span>
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

function NeedsYou({ today }: { today: string }) {
  const { state } = useStore();
  const actions = useInboxActions();
  const due = inboxItems(state, today).filter((i) => i.due);
  const suggestions = state.suggestions.filter((s) => s.status === 'new');
  // Planted directions (demo data) aren't work the PM has under way.
  const drafts = state.decisions
    .filter((d) => d.status !== 'decided' && !d.speculative && isMine(d, state))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <aside className="needs" aria-labelledby="needs-title">
      <h2 id="needs-title" className="needs-title">
        Needs you
      </h2>

      <section aria-labelledby="needs-due" className="needs-section">
        <h3 id="needs-due" className="kicker">
          Due {due.length > 0 && <span className="badge needs-badge">{due.length}</span>}
        </h3>
        {due.length === 0 ? (
          <p className="muted needs-empty">Nothing due. Nice.</p>
        ) : (
          <ul className="inbox-list">
            {due.map((item) => (
              <InboxRow key={item.id} item={item} />
            ))}
          </ul>
        )}
      </section>

      {suggestions.length > 0 && (
        <section aria-labelledby="needs-suggest" className="needs-section">
          <h3 id="needs-suggest" className="kicker ai-mark">
            ✦ Rooted suggests deciding
          </h3>
          <ul className="needs-suggestions">
            {suggestions.map((s) => (
              <li key={s.id} className="needs-suggestion">
                <p className="needs-suggestion-q">{s.question}</p>
                {/* Nothing scans Slack yet; these are hand-written examples (decision 0005). */}
                <p>
                  <span className="sample-badge">Sample</span>
                </p>
                <p className="muted needs-small">{s.why}</p>
                {s.evidence[0] && (
                  <blockquote className="needs-quote">
                    “{s.evidence[0].snippet}”{' '}
                    <span className="muted">
                      — {s.evidence[0].author ? `${s.evidence[0].author}, ` : ''}
                      {s.evidence[0].sourceLabel}
                    </span>
                  </blockquote>
                )}
                <div className="row needs-actions">
                  <button type="button" className="btn btn-secondary" onClick={() => actions.startSuggestion(s)}>
                    Start this decision
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => actions.dismissSuggestion(s.id)}>
                    Dismiss
                  </button>
                  <ReportWrongAnswer surface="suggestion" targetId={s.id} excerpt={s.question} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="needs-drafts" className="needs-section">
        <h3 id="needs-drafts" className="kicker">
          Your decisions in progress
        </h3>
        {drafts.length === 0 ? (
          <p className="muted needs-empty">
            None. <Link to="/decisions/new">Start one</Link>
          </p>
        ) : (
          <ul className="needs-drafts">
            {drafts.map((d) => (
              <li key={d.id}>
                <Link to={continuePath(d)} className="needs-draft">
                  <span className="dot dot-progress" aria-hidden="true" />
                  <span>{d.question}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </aside>
  );
}
