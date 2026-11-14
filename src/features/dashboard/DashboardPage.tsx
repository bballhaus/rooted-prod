// F-17, F-19: home. The "Needs you" rail on the left says what the PM has to
// do and which decisions they can make; the decision map fills the rest. The
// map is a tree of linked decisions (0019), a timeline in lanes, or a list,
// picked from one switch in the dock. A key on the canvas says what the colors
// and lines mean and sets what the colors show. Picking a decision opens its
// details and lights up its lineage.
import { useEffect, useId, useMemo, useState, type CSSProperties } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAi } from '../../agent/AiContext';
import { errorCode, type AiErrorCode } from '../../agent/client';
import { findLinks, spotDecisions } from '../../agent/links';
import { AiErrorNotice } from '../../components/AiErrorNotice';
import { rankDecisions } from '../../store/search';
import { Avatar, personColor } from '../../components/Avatar';
import {
  IconArrowRight,
  IconChevronLeft,
  IconGraph,
  IconRows,
  IconSliders,
  IconTimeline,
} from '../../components/icons';
import { ReportWrongAnswer } from '../../components/ReportWrongAnswer';
import {
  chosenLabel,
  decisionDate,
  inboxItems,
  isMine,
  type InboxItem,
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
import { continuePath, formatDate, STATUS_LABEL } from '../log/format';
import { DecisionDetail } from './DecisionDetail';
import { DecisionMap, goalPalette, type ColorBy } from './DecisionMap';
import { InboxRow } from './InboxRow';
import { LANE_LABEL, laneOf, type LaneBy } from './mapLayout';
import { useInboxActions } from './useInboxActions';
import './dashboard.css';

type View = 'tree' | 'timeline' | 'list';
type StatusFilter = 'all' | MapStatus;

const VIEW_KEY = 'rooted-map-view';
const DETAIL_KEY = 'rooted-map-detailed';
const RAIL_KEY = 'rooted-needs-open';
const KEY_KEY = 'rooted-map-key';

const VIEWS: { id: View; label: string; Icon: typeof IconGraph }[] = [
  { id: 'tree', label: 'Tree', Icon: IconGraph },
  { id: 'timeline', label: 'Timeline', Icon: IconTimeline },
  { id: 'list', label: 'List', Icon: IconRows },
];

const COLOR_LABEL: Record<ColorBy, string> = { status: 'Status', goal: 'Goal', owner: 'Who decided' };

// Status colors in the key, in the order a decision moves through them.
const STATUS_KEY: { status: MapStatus; color: string }[] = [
  { status: 'open', color: 'var(--ochre)' },
  { status: 'decided', color: 'var(--ink2)' },
  { status: 'outcome-due', color: 'var(--alert)' },
  { status: 'outcome-logged', color: 'var(--moss)' },
];

const narrow = () => typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 880px)').matches;

function initialView(): View {
  try {
    const saved = localStorage.getItem(VIEW_KEY);
    if (saved === 'tree' || saved === 'timeline' || saved === 'list') return saved;
  } catch {
    // storage can be unavailable
  }
  // A tree doesn't fit a phone; start small screens on the list.
  return narrow() ? 'list' : 'tree';
}

// A remembered boolean preference, defaulting when storage is empty or unavailable.
function storedFlag(key: string, fallback: boolean): boolean {
  try {
    const v = localStorage.getItem(key);
    if (v === 'on') return true;
    if (v === 'off') return false;
  } catch {
    // storage can be unavailable
  }
  return fallback;
}

function useStoredFlag(key: string, fallback: () => boolean) {
  const [on, setOn] = useState(() => storedFlag(key, fallback()));
  useEffect(() => {
    try {
      localStorage.setItem(key, on ? 'on' : 'off');
    } catch {
      // the preference just won't be remembered
    }
  }, [key, on]);
  return [on, setOn] as const;
}

export function searchMatches(q: string, state: AppState): Set<string> | null {
  const query = q.trim().toLowerCase();
  if (!query) return null;
  const ranked = rankDecisions(query, state).map((d) => d.id);
  const literal = state.decisions.filter((d) => d.question.toLowerCase().includes(query)).map((d) => d.id);
  return new Set([...ranked, ...literal]);
}

/** What's due on the PM's own decisions: outcomes to log and deadlines close or passed. */
export function todoItems(state: AppState, today: string): InboxItem[] {
  return inboxItems(state, today).filter((i) => i.kind === 'outcome-due' || i.kind === 'deadline');
}

export function DashboardPage() {
  const { state } = useStore();
  const { highlight } = useAgent();
  const [params, setParams] = useSearchParams();
  const today = localToday();
  const ids = { group: useId(), who: useId(), tag: useId(), status: useId(), color: useId(), filters: useId(), key: useId() };

  const [view, setView] = useState<View>(initialView);
  const [colorBy, setColorBy] = useState<ColorBy>('status');
  const [detailed, setDetailed] = useStoredFlag(DETAIL_KEY, () => false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  // Needs you is open on wide screens, so what the PM has to do is always in reach.
  const [railOpen, setRailOpen] = useStoredFlag(RAIL_KEY, () => !narrow());
  const [keyOpen, setKeyOpen] = useStoredFlag(KEY_KEY, () => true);
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
  const activeFilters = Number(who !== 'everyone') + Number(status !== 'all') + Number(tag !== '');
  function clearFilters() {
    setWho('everyone');
    setStatus('all');
    setTag('');
  }
  // The list hides what search doesn't match; the map dims it so the thread stays visible.
  const listed = matchIds ? filtered.filter((d) => matchIds.has(d.id)) : filtered;
  const selected = state.decisions.find((d) => d.id === selectedId);

  function select(id: string | undefined) {
    const next = new URLSearchParams(params);
    if (id) next.set('focus', id);
    else next.delete('focus');
    setParams(next, { replace: true });
  }

  const dueCount = todoItems(state, today).length;
  const hasDecisions = state.decisions.length > 0;
  const onMap = view !== 'list';

  return (
    <div className={railOpen ? 'dash' : 'dash dash-rail-hidden'}>
      {railOpen && <NeedsYou today={today} onMinimize={() => setRailOpen(false)} />}

      <section className="dash-main" aria-labelledby="dash-title">
        {/* The workspace name is a landmark, not a banner — the canvas is what you see. */}
        <h1 id="dash-title" className="visually-hidden">
          Decisions
        </h1>

        <div className={selected ? 'dash-stage dash-stage-detail' : 'dash-stage'}>
          <p className="visually-hidden" role="status">
            {matchIds ? `${listed.length} of ${state.decisions.length} decisions match “${q}”` : ''}
          </p>

          {!railOpen && hasDecisions && (
            <button
              type="button"
              className="dash-rail-reopen"
              aria-label={`Show the Needs you panel${dueCount ? `, ${dueCount} due` : ''}`}
              onClick={() => setRailOpen(true)}
            >
              Needs you
              {dueCount > 0 && (
                <span className="badge dash-rail-badge" aria-hidden="true">
                  {dueCount}
                </span>
              )}
            </button>
          )}

          {!hasDecisions ? (
            <EmptyState />
          ) : filtered.length === 0 ? (
            <div className="banner dash-empty dash-empty-filters">
              <p>No decisions match those filters.</p>
              <button type="button" className="btn btn-secondary" onClick={clearFilters}>
                Clear filters
              </button>
            </div>
          ) : onMap ? (
            <DecisionMap
              state={state}
              decisions={filtered}
              mode={view === 'timeline' ? 'timeline' : 'tree'}
              laneBy={laneBy}
              colorBy={colorBy}
              detailed={detailed}
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

          {/* What the colors and lines mean, beside the control that picks the colors. */}
          {hasDecisions && onMap && filtered.length > 0 && !selected && (
            <MapKey
              open={keyOpen}
              onToggle={() => setKeyOpen(!keyOpen)}
              decisions={filtered}
              colorBy={colorBy}
              onColorBy={setColorBy}
              tree={view === 'tree'}
              detailed={detailed}
              onDetailed={setDetailed}
              colorId={ids.color}
              keyId={ids.key}
            />
          )}

          {/* The workspace dock floats at the bottom, out of the canvas's way.
              Filters open as a panel above it, so they never take up standing space. */}
          {hasDecisions && (
            <div className="dash-dock">
              {filtersOpen && (
                <section className="dash-filters" id={ids.filters} aria-labelledby={`${ids.filters}-title`}>
                  <div className="dash-filters-head">
                    <h2 id={`${ids.filters}-title`} className="dash-filters-title">
                      Show decisions
                    </h2>
                    <p className="dash-filters-count">
                      {filtered.length} of {state.decisions.length} shown
                    </p>
                  </div>
                  <div className="dash-filters-fields">
                    <div className="field dash-field">
                      <label htmlFor={ids.who}>Who decided</label>
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
                    <div className="field dash-field">
                      <label htmlFor={ids.tag}>Tag</label>
                      <select id={ids.tag} className="select" value={tag} onChange={(e) => setTag(e.target.value)}>
                        <option value="">Any tag</option>
                        {tags.map((t) => (
                          <option key={t} value={t}>
                            #{t}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="dash-filters-foot">
                    <button type="button" className="btn btn-ghost" disabled={activeFilters === 0} onClick={clearFilters}>
                      Clear filters
                    </button>
                    <button type="button" className="btn btn-secondary" onClick={() => setFiltersOpen(false)}>
                      Done
                    </button>
                  </div>
                </section>
              )}

              <div className="dash-dock-bar">
                <div className="dash-seg" role="group" aria-label="View">
                  {VIEWS.map(({ id, label, Icon }) => (
                    <button
                      key={id}
                      type="button"
                      className="toggle"
                      aria-pressed={view === id}
                      onClick={() => setView(id)}
                    >
                      <Icon size={15} /> {label}
                    </button>
                  ))}
                </div>
                {view !== 'tree' && (
                  <div className="dash-dock-field">
                    <label htmlFor={ids.group} className="visually-hidden">
                      Group by
                    </label>
                    <select id={ids.group} className="select" value={laneBy} onChange={(e) => setLaneBy(e.target.value as LaneBy)}>
                      {(Object.keys(LANE_LABEL) as LaneBy[]).map((k) => (
                        <option key={k} value={k}>
                          {k === 'none' ? 'No groups' : `By ${LANE_LABEL[k].toLowerCase()}`}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <span className="dash-dock-sep" aria-hidden="true" />
                <button
                  type="button"
                  className="toggle dash-tool"
                  aria-expanded={filtersOpen}
                  aria-controls={ids.filters}
                  aria-label={activeFilters ? `Filters, ${activeFilters} on` : 'Filters'}
                  onClick={() => setFiltersOpen(!filtersOpen)}
                >
                  <IconSliders size={15} /> Filters
                  {activeFilters > 0 && (
                    <span className="dash-count" aria-hidden="true">
                      {activeFilters}
                    </span>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

// The map's key: what each color and line means, with the choice of what the
// colors show right above it. Collapses to one button.
function MapKey({
  open,
  onToggle,
  decisions,
  colorBy,
  onColorBy,
  tree,
  detailed,
  onDetailed,
  colorId,
  keyId,
}: {
  open: boolean;
  onToggle: () => void;
  decisions: Decision[];
  colorBy: ColorBy;
  onColorBy: (c: ColorBy) => void;
  tree: boolean;
  detailed: boolean;
  onDetailed: (on: boolean) => void;
  colorId: string;
  keyId: string;
}) {
  const { state } = useStore();
  if (!open) {
    return (
      <button type="button" className="map-key-show" aria-expanded={false} aria-controls={keyId} onClick={onToggle}>
        <span className="map-key-chip" aria-hidden="true" /> Key · {COLOR_LABEL[colorBy]}
      </button>
    );
  }
  const items =
    colorBy === 'status'
      ? [
          ...STATUS_KEY.map((s) => ({ key: s.status, label: MAP_STATUS_LABEL[s.status], color: s.color, dashed: s.status === 'open' })),
          ...(decisions.some((d) => d.speculative)
            ? [{ key: 'speculative', label: 'Direction to explore', color: 'var(--alive-dot)', dashed: true }]
            : []),
        ]
      : colorBy === 'goal'
        ? goalPalette(decisions).legend.map((g) => ({ key: g.label, ...g, dashed: false }))
        : [...new Set(decisions.map((d) => ownerOf(d, state)?.id))].map((id) => {
            const mate = state.teammates.find((t) => t.id === id);
            return { key: id ?? 'unknown', label: mate?.name ?? 'Unknown', color: personColor(id, state.teammates), dashed: false };
          });
  return (
    <section className="map-key" id={keyId} aria-label="Map key">
      <div className="map-key-head">
        <label htmlFor={colorId} className="map-key-title">
          Color by
        </label>
        <select id={colorId} className="select map-key-select" value={colorBy} onChange={(e) => onColorBy(e.target.value as ColorBy)}>
          {(Object.keys(COLOR_LABEL) as ColorBy[]).map((c) => (
            <option key={c} value={c}>
              {COLOR_LABEL[c]}
            </option>
          ))}
        </select>
        <button type="button" className="icon-btn map-key-hide" aria-label="Hide the key" aria-expanded onClick={onToggle}>
          <IconChevronLeft size={16} />
        </button>
      </div>
      <ul className="map-key-list" aria-label={colorBy === 'goal' ? 'Goals' : colorBy === 'owner' ? 'People' : 'Statuses'}>
        {items.map((i) => (
          <li key={i.key} className="map-key-item">
            <span
              className={i.dashed ? 'map-key-swatch map-key-swatch-dashed' : 'map-key-swatch'}
              style={{ '--node-accent': i.color } as CSSProperties}
              aria-hidden="true"
            />
            {i.label}
          </li>
        ))}
      </ul>
      <ul className="map-key-list map-key-lines" aria-label="Lines">
        <li className="map-key-item">
          <svg width="28" height="8" aria-hidden="true">
            <line x1="0" y1="4" x2="28" y2="4" stroke="var(--ink2)" strokeWidth="1.6" />
          </svg>
          Builds on
        </li>
        <li className="map-key-item ai-mark">
          <svg width="28" height="8" aria-hidden="true">
            <line x1="0" y1="4" x2="28" y2="4" stroke="var(--ai-line)" strokeWidth="1.6" strokeDasharray="6 5" />
          </svg>
          ✦ Rooted thinks they’re linked
        </li>
      </ul>
      <label className="checkbox map-key-check">
        <input type="checkbox" checked={detailed} onChange={(e) => onDetailed(e.target.checked)} />
        Show date, owner and goal on cards
      </label>
      <p className="map-key-hint">
        Pick a decision to light up what it built on and what it led to.{tree ? ' Drag cards to rearrange.' : ''}
      </p>
    </section>
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

// F-19, F-R2: ask Rooted to look for decisions to make in Slack, or for
// connections between decisions. What it finds is a suggestion (✦) until the
// PM accepts or dismisses it.
function useAgentScan() {
  const { state, dispatch } = useStore();
  const ai = useAi();
  const [busy, setBusy] = useState<'spot' | 'links' | null>(null);
  const [result, setResult] = useState<{ kind: 'spot' | 'links'; error?: AiErrorCode; found?: number } | null>(null);

  async function scan(kind: 'spot' | 'links') {
    setResult(null);
    if (!ai) {
      setResult({ kind, error: 'not_configured' });
      return;
    }
    setBusy(kind);
    try {
      if (kind === 'spot') {
        const suggestions = await spotDecisions(ai, state);
        dispatch({ type: 'addSuggestions', suggestions });
        setResult({ kind, found: suggestions.length });
      } else {
        const links = await findLinks(ai, state);
        dispatch({ type: 'addLinks', links });
        setResult({ kind, found: links.length });
      }
    } catch (e) {
      setResult({ kind, error: errorCode(e) });
    } finally {
      setBusy(null);
    }
  }
  return { busy, result, scan };
}

// F-16, F-19, F-R2: what the PM has to do, and the decisions they can make,
// each with its next step on it. Rooted's own suggestions stay marked ✦.
function NeedsYou({ today, onMinimize }: { today: string; onMinimize: () => void }) {
  const { state } = useStore();
  const actions = useInboxActions();
  const { busy, result, scan } = useAgentScan();
  const canLink = state.decisions.length >= 2;
  const todo = todoItems(state, today);
  const suggestions = state.suggestions.filter((s) => s.status === 'new');
  const pendingLinks = state.links.filter((l) => l.origin === 'ai' && l.status === 'suggested').length;
  // Planted directions (demo data) aren't work the PM has under way.
  const drafts = state.decisions
    .filter((d) => d.status !== 'decided' && !d.speculative && isMine(d, state))
    .sort((a, b) => (a.deadline ?? '9999').localeCompare(b.deadline ?? '9999') || b.createdAt.localeCompare(a.createdAt));
  const counted = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  const openQuestions = (id: string) => state.gaps.filter((g) => g.decisionId === id && !g.answer).length;

  return (
    <aside className="needs" aria-labelledby="needs-title">
      <div className="needs-head">
        <div className="needs-head-text">
          <h2 id="needs-title" className="needs-title">
            Needs you
          </h2>
          <p className="needs-summary">
            {todo.length ? `${todo.length} due` : 'Nothing due'} · {counted(drafts.length, 'decision', 'decisions')} in progress
          </p>
        </div>
        <button type="button" className="icon-btn needs-minimize" aria-label="Hide the Needs you panel" onClick={onMinimize}>
          <IconChevronLeft size={18} />
        </button>
      </div>

      <section aria-labelledby="needs-todo" className="needs-section">
        <h3 id="needs-todo" className="needs-h3">
          Due {todo.length > 0 && <span className="badge needs-badge">{todo.length}</span>}
        </h3>
        {todo.length === 0 ? (
          <p className="needs-empty">You’re all caught up. Outcomes to log and close deadlines show up here.</p>
        ) : (
          <ul className="inbox-list needs-todo">
            {todo.map((item) => (
              <InboxRow key={item.id} item={item} />
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="needs-decide" className="needs-section">
        <h3 id="needs-decide" className="needs-h3">
          Decisions to make
        </h3>
        {drafts.length > 0 && (
          <ul className="needs-drafts" aria-label="Your decisions in progress">
            {drafts.map((d) => (
              <li key={d.id}>
                <Link to={continuePath(d)} className="needs-draft">
                  <span className="needs-draft-text">
                    <span className="needs-draft-q">{d.question}</span>
                    <span className="needs-draft-meta">
                      <span className="dot dot-progress" aria-hidden="true" />
                      <span>
                        {STATUS_LABEL[d.status]}
                        {openQuestions(d.id) > 0 && <> · {counted(openQuestions(d.id), 'open question', 'open questions')}</>}
                        {d.deadline && (
                          <>
                            {' '}
                            · <span className={d.deadline <= today ? 'due-label' : undefined}>decide by {formatDate(d.deadline)}</span>
                          </>
                        )}
                      </span>
                    </span>
                  </span>
                  <IconArrowRight size={16} />
                </Link>
              </li>
            ))}
          </ul>
        )}

        {suggestions.length > 0 && (
          <>
            <h4 className="needs-h4 ai-mark">✦ Rooted suggests deciding</h4>
            <ul className="needs-suggestions">
              {suggestions.map((s) => (
                <li key={s.id} className="needs-suggestion">
                  <p className="needs-suggestion-q">{s.question}</p>
                  <p className="needs-small">{s.why}</p>
                  {s.evidence[0] && (
                    <blockquote className="needs-quote">
                      “{s.evidence[0].snippet}”{' '}
                      <span className="muted">
                        — {s.evidence[0].author ? `${s.evidence[0].author}, ` : ''}
                        {s.evidence[0].sourceLabel}
                      </span>{' '}
                      {s.evidence[0].link && (
                        <a href={s.evidence[0].link} target="_blank" rel="noreferrer">
                          Open in Slack
                        </a>
                      )}
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
          </>
        )}

        {drafts.length === 0 && suggestions.length === 0 && (
          <p className="needs-empty">No decisions in progress. Start one, or let Rooted check Slack for calls the team is circling.</p>
        )}

        <div className="needs-actions needs-actions-stack">
          <Link to="/decisions/new" className="btn">
            New decision
          </Link>
          <button type="button" className="btn btn-secondary" disabled={busy !== null} onClick={() => scan('spot')}>
            {busy === 'spot' ? 'Reading your channels…' : 'Check Slack for decisions'}
          </button>
        </div>
        <div aria-live="polite">
          {result?.kind === 'spot' &&
            (result.error ? (
              <AiErrorNotice code={result.error} onRetry={() => scan('spot')} />
            ) : (
              <p className="needs-small">
                {result.found
                  ? `Rooted spotted ${result.found} decision${result.found === 1 ? '' : 's'} to consider above.`
                  : 'Nothing new to decide in your channels right now.'}
              </p>
            ))}
        </div>
      </section>

      <section aria-labelledby="needs-ask" className="needs-section">
        <h3 id="needs-ask" className="needs-h3 ai-mark">
          ✦ From Rooted
        </h3>
        <Link to="/patterns" className="needs-link">
          <span className="needs-draft-text">
            <span className="needs-draft-q">Patterns and trends</span>
            <span className="needs-draft-meta">How your decisions turn out, and what’s likely next</span>
          </span>
          <IconArrowRight size={16} />
        </Link>
        {pendingLinks > 0 && (
          <p className="needs-small">
            {counted(pendingLinks, 'connection', 'connections')} Rooted found {pendingLinks === 1 ? 'is' : 'are'} waiting for
            you. {pendingLinks === 1 ? 'It shows' : 'They show'} dashed on the map; pick a decision to connect or dismiss.
          </p>
        )}
        <button
          type="button"
          className="btn btn-secondary needs-wide"
          disabled={busy !== null || !canLink}
          aria-describedby={canLink ? undefined : 'needs-links-hint'}
          onClick={() => scan('links')}
        >
          {busy === 'links' ? 'Looking for connections…' : 'Find connections'}
        </button>
        {!canLink && (
          <p id="needs-links-hint" className="needs-small">
            Finding connections needs at least two decisions.
          </p>
        )}
        <div aria-live="polite">
          {result?.kind === 'links' &&
            (result.error ? (
              <AiErrorNotice code={result.error} onRetry={() => scan('links')} />
            ) : (
              <p className="needs-small">
                {result.found
                  ? `Rooted found ${result.found} possible connection${result.found === 1 ? '' : 's'}. They show dashed on the map until you connect or dismiss them.`
                  : 'No new connections found.'}
              </p>
            ))}
        </div>
      </section>
    </aside>
  );
}
