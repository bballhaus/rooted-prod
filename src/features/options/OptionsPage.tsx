// F-10, F-11: the options step. The agent maps 2–4 branches from the evidence
// brief and can branch any of them out into sub-options; the tree graph shows
// the whole thing, the cards below compare one level at a time. The PM edits,
// adds their own, prunes with a reason, and chooses one. The agent never
// decides: scores and ratings are a rough guide and only the PM's chosen
// branch gets the wine treatment.
import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { fetchOptions, fetchSubOptions, splitFor } from '../../agent/options';
import { Dialog } from '../../components/Dialog';
import { ReportWrongAnswer } from '../../components/ReportWrongAnswer';
import { Stepper } from '../../components/Stepper';
import { newId, useDecision, useStore } from '../../store/store';
import { ancestorIds, childrenOf, depthOf, pathLabel, underPruned } from '../../store/tree';
import type { ContextItem, Criteria, CriterionKey, OptionNode } from '../../types';
import { LogDecisionDialog } from '../log/LogDecisionDialog';
import { CRITERIA, DecisionTree, type LinkedDecision } from './DecisionTree';
import './options.css';

const NARRATION = ['Reading your evidence brief', 'Mapping options', 'Weighing pros and cons'];
const SPLIT_LABEL: Record<string, string> = {
  rollout: 'how widely to roll it out',
  timing: 'when to start',
  audience: 'which plans get it',
  measure: 'how to judge it',
};

function isUserOption(o: OptionNode): boolean {
  return o.id.startsWith('o-user-');
}

function lines(text: string): string[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

export function OptionsPage() {
  const { id } = useParams();
  const decision = useDecision(id);
  const { state, dispatch } = useStore();
  const [generating, setGenerating] = useState(false);
  const [step, setStep] = useState(0);
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const [pruning, setPruning] = useState<OptionNode | null>(null);
  const [confirmRegen, setConfirmRegen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [announce, setAnnounce] = useState('');
  // Which level the cards compare (null = top-level options) and which node
  // the PM last picked in the graph.
  const [levelParent, setLevelParent] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | undefined>(undefined);
  const [branching, setBranching] = useState<string | null>(null);
  const run = useRef(0);

  const options = state.options.filter((o) => o.decisionId === id);
  const decided = decision?.status === 'decided';

  const generate = useCallback(() => {
    if (!decision) return;
    const ticket = ++run.current;
    setGenerating(true);
    setStep(0);
    fetchOptions(decision, state.contextItems, state.gaps).then((next) => {
      if (ticket !== run.current) return;
      dispatch({ type: 'setOptions', decisionId: decision.id, options: next });
      if (decision.status !== 'options') {
        dispatch({
          type: 'updateDecision',
          decisionId: decision.id,
          patch: { status: 'options' },
        });
      }
      setSelectedId(undefined);
      setLevelParent(null);
      setFocusId(undefined);
      setGenerating(false);
      setAnnounce(`${next.length} options ready. Scores are a rough guide; you make the call.`);
    });
  }, [decision, state.contextItems, state.gaps, dispatch]);

  // Generate once when the decision has no options yet.
  const needsOptions = !!decision && !decided && options.length === 0;
  useEffect(() => {
    if (needsOptions) generate();
    return () => {
      run.current++;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsOptions]);

  // Narrate progress while the agent "thinks".
  useEffect(() => {
    if (!generating) return;
    const t = setInterval(() => setStep((s) => Math.min(s + 1, NARRATION.length - 1)), 300);
    return () => clearInterval(t);
  }, [generating]);

  // A pruned branch, or anything under one, can't stay chosen.
  useEffect(() => {
    if (!selectedId) return;
    if (options.find((o) => o.id === selectedId)?.state === 'pruned' || underPruned(options, selectedId))
      setSelectedId(undefined);
  }, [options, selectedId]);

  // F-10: the agent splits one branch into sub-options.
  function branchOut(parent: OptionNode) {
    if (!decision) return;
    setBranching(parent.id);
    setAnnounce('');
    fetchSubOptions(decision, parent, options, state.contextItems).then((subs) => {
      dispatch({ type: 'setOptions', decisionId: decision.id, options: [...options, ...subs] });
      setBranching(null);
      setLevelParent(parent.id);
      setFocusId(undefined);
      setAnnounce(`${subs.length} sub-options added under ${parent.label}.`);
    });
  }

  function showInCards(o: OptionNode | null) {
    setLevelParent(o ? o.parentId : null);
    setFocusId(o?.id);
    if (o) {
      // Let the level render, then bring the card into view.
      setTimeout(() => document.getElementById(`options-card-${o.id}`)?.scrollIntoView?.({ block: 'nearest' }), 0);
    }
  }

  if (!decision) {
    return (
      <div className="page">
        <h1 className="page-title">Decision not found</h1>
        <p className="lead">There’s no decision with that link. It may have been deleted with your data.</p>
        <p>
          <Link to="/">Back to your decisions</Link>
        </p>
      </div>
    );
  }

  const chosenId = decided ? (decision.chosenOptionId ?? options.find((o) => o.state === 'chosen')?.id) : selectedId;
  const level = childrenOf(options, levelParent);
  const levelNode = options.find((o) => o.id === levelParent);
  const crumbs = levelParent
    ? [...ancestorIds(options, levelParent), levelParent].map((x) => options.find((o) => o.id === x)!)
    : [];
  const open = level.filter((o) => o.state === 'open' && !isUserOption(o));
  const topScore = open.length ? Math.max(...open.map((o) => o.score)) : undefined;
  const topId = topScore === undefined ? undefined : open.find((o) => o.score === topScore)?.id;
  const cols = level.length === 4 ? 2 : Math.max(1, Math.min(level.length, 3));

  // Past decisions the brief cited, so the graph shows what this one builds on.
  const linked: LinkedDecision[] = state.contextItems
    .filter((c) => c.decisionId === decision.id && c.origin === 'past-decision' && !c.removed && c.link)
    .map((c) => state.decisions.find((d) => `/decisions/${d.id}` === c.link))
    .filter((d): d is NonNullable<typeof d> => !!d && d.id !== decision.id)
    .map((d) => ({
      id: d.id,
      question: d.question,
      outcome: state.options.find((o) => o.id === d.chosenOptionId)?.label,
    }));

  return (
    <div className="page">
      <Stepper decision={decision} current="options" />
      <header className="stack options-head">
        <p className="kicker">Options</p>
        <h1 className="page-title">{decision.question}</h1>
        <p className="lead">
          {decided
            ? 'This decision is logged. The branches below are read-only.'
            : 'Rooted mapped these branches from your evidence brief. Edit them, add your own, prune what doesn’t fit, then choose one. Scores are a rough guide; you make the call.'}
        </p>
      </header>

      <div role="status" aria-live="polite" className="options-status">
        {generating ? (
          <span className="row">
            <span className="spinner" aria-hidden="true" />
            <span>{NARRATION[step]}…</span>
          </span>
        ) : (
          <span className="visually-hidden">{announce}</span>
        )}
      </div>

      {decided && (
        <div className="banner row options-banner">
          <span>
            You logged this decision
            {decision.loggedAt ? ` on ${decision.loggedAt.slice(0, 10)}` : ''}.
          </span>
          <Link to={`/decisions/${decision.id}`} className="btn btn-secondary">
            View the decision record
          </Link>
        </div>
      )}

      {!generating && options.length === 0 && decided && (
        <p className="muted">No options were recorded for this decision.</p>
      )}

      {!generating && options.length > 0 && (
        <section aria-labelledby="options-tree-title" className="stack options-tree-section">
          <div className="row options-tree-head">
            <h2 id="options-tree-title" className="section-title">
              Decision tree
            </h2>
            <p className="muted options-legend">
              Each branch shows rough ratings for impact, effort, risk and evidence (1–5) and its rough score. Pick a
              node to compare it with its siblings below.
            </p>
          </div>
          <DecisionTree
            question={decision.question}
            options={options}
            linked={linked}
            chosenId={chosenId}
            focusId={focusId}
            onFocus={showInCards}
          />
        </section>
      )}

      {!generating && options.length > 0 && (
        <section aria-labelledby="options-branches" className="stack">
          <nav aria-label="Tree level" className="row options-crumbs">
            <button
              type="button"
              className="btn btn-ghost"
              aria-current={levelParent === null ? 'location' : undefined}
              onClick={() => showInCards(null)}
            >
              Top-level options
            </button>
            {crumbs.map((o, i) => (
              <span key={o.id} className="row options-crumb">
                <span aria-hidden="true">›</span>
                <button
                  type="button"
                  className="btn btn-ghost"
                  aria-current={i === crumbs.length - 1 ? 'location' : undefined}
                  onClick={() => {
                    setLevelParent(o.id);
                    setFocusId(undefined);
                  }}
                >
                  {o.label}
                </button>
              </span>
            ))}
          </nav>
          <h2 id="options-branches" className="section-title">
            {levelNode ? `Sub-options of “${levelNode.label}”` : 'Top-level options'}
          </h2>
          {levelNode && levelNode.state === 'pruned' && (
            <p className="muted">This branch is pruned, so its sub-options can’t be chosen unless you restore it.</p>
          )}
          {level.length === 0 && <p className="muted">No sub-options here yet.</p>}
          <ul className="options-grid" style={{ ['--options-cols' as string]: cols }}>
            {level.map((o) => (
              <OptionCard
                key={o.id}
                option={o}
                items={state.contextItems}
                readOnly={decided}
                chosen={chosenId === o.id}
                highest={topId === o.id}
                focused={focusId === o.id}
                blocked={underPruned(options, o.id)}
                subCount={childrenOf(options, o.id).length}
                splitHint={SPLIT_LABEL[splitFor(depthOf(options, o.id))]}
                branching={branching === o.id}
                branchBusy={branching !== null}
                onBranchOut={() => branchOut(o)}
                onOpenSubs={() => {
                  setLevelParent(o.id);
                  setFocusId(undefined);
                }}
                onChoose={() => {
                  const next = selectedId === o.id ? undefined : o.id;
                  setSelectedId(next);
                  setAnnounce(next ? `${o.label} chosen.` : `${o.label} is no longer chosen.`);
                }}
                onPrune={() => setPruning(o)}
                onRestore={() => {
                  dispatch({
                    type: 'updateOption',
                    optionId: o.id,
                    patch: { state: 'open', pruneReason: undefined },
                  });
                  setAnnounce(`${o.label} restored.`);
                }}
                onSave={(patch) => dispatch({ type: 'updateOption', optionId: o.id, patch })}
              />
            ))}
          </ul>
        </section>
      )}

      {!decided && !generating && options.length > 0 && (
        <>
          <AddOptionForm
            parent={levelNode}
            onAdd={(o) => {
              dispatch({
                type: 'setOptions',
                decisionId: decision.id,
                options: [...options, { ...o, decisionId: decision.id, parentId: levelParent }],
              });
              setAnnounce(`${o.label} added.`);
            }}
          />
          <div className="row options-actions">
            <button type="button" className="btn btn-lg" onClick={() => setLogOpen(true)}>
              Log decision
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setConfirmRegen(true)}>
              Regenerate options
            </button>
            <span className="muted">
              {chosenId ? `Chosen: ${pathLabel(options, chosenId)}` : 'No branch chosen yet.'}
            </span>
          </div>
          <p className="muted options-note">Talking an option through in chat isn’t part of this prototype yet.</p>
        </>
      )}

      <PruneDialog
        option={pruning}
        onClose={() => setPruning(null)}
        onPrune={(reason) => {
          if (!pruning) return;
          dispatch({
            type: 'updateOption',
            optionId: pruning.id,
            patch: { state: 'pruned', pruneReason: reason },
          });
          setAnnounce(`${pruning.label} pruned.`);
          setPruning(null);
        }}
      />

      <Dialog open={confirmRegen} onClose={() => setConfirmRegen(false)} title="Regenerate options?">
        <p>
          Rooted will map a fresh set of branches from your evidence brief. Your edits, pruned branches and any options
          you added will be replaced.
        </p>
        <div className="row">
          <button
            type="button"
            className="btn"
            onClick={() => {
              setConfirmRegen(false);
              generate();
            }}
          >
            Replace options
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => setConfirmRegen(false)}>
            Keep current options
          </button>
        </div>
      </Dialog>

      {!decided && (
        <LogDecisionDialog
          decisionId={decision.id}
          open={logOpen}
          onClose={() => setLogOpen(false)}
          chosenOptionId={chosenId}
        />
      )}
    </div>
  );
}

function OptionCard({
  option,
  items,
  readOnly,
  chosen,
  highest,
  focused,
  blocked,
  subCount,
  splitHint,
  branching,
  branchBusy,
  onBranchOut,
  onOpenSubs,
  onChoose,
  onPrune,
  onRestore,
  onSave,
}: {
  option: OptionNode;
  items: ContextItem[];
  readOnly: boolean;
  chosen: boolean;
  highest: boolean;
  focused: boolean;
  blocked: boolean; // under a pruned branch
  subCount: number;
  splitHint?: string;
  branching: boolean;
  branchBusy: boolean;
  onBranchOut: () => void;
  onOpenSubs: () => void;
  onChoose: () => void;
  onPrune: () => void;
  onRestore: () => void;
  onSave: (patch: Partial<OptionNode>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const headingId = useId();
  const pruned = option.state === 'pruned';
  const mine = isUserOption(option);
  const evidence = option.contextIds
    .map((cid) => items.find((c) => c.id === cid))
    .filter((c): c is ContextItem => !!c && !c.removed && !c.flaggedInaccurate);

  const classes = ['card', 'options-card'];
  if (chosen) classes.push('card-rec');
  if (pruned || blocked) classes.push('options-card-pruned');
  if (focused) classes.push('options-card-focus');

  return (
    <li id={`options-card-${option.id}`} className={classes.join(' ')} aria-labelledby={headingId}>
      <div className="card-section stack options-card-head">
        <div className="row options-tags">
          <span className={`dot ${chosen ? 'dot-chosen' : pruned ? 'dot-pruned' : 'dot-alive'}`} aria-hidden="true" />
          {chosen && <span className="pill pill-rec">{readOnly ? 'Chosen' : 'Your choice'}</span>}
          {pruned && <span className="pill">Pruned</span>}
          {highest && !pruned && <span className="pill options-pill-top">Highest rough score</span>}
          {blocked && !pruned && <span className="pill">Under a pruned branch</span>}
          {mine && <span className="pill">Your option</span>}
        </div>
        {editing ? (
          <OptionEditForm
            option={option}
            onCancel={() => setEditing(false)}
            onSave={(patch) => {
              onSave(patch);
              setEditing(false);
            }}
          />
        ) : (
          <>
            <h3 id={headingId} className="section-title">
              <span className={pruned ? 'pruned-label' : undefined}>{option.label}</span>
            </h3>
            <p className="options-summary">{option.summary}</p>
          </>
        )}
      </div>

      {pruned && (
        <div className="card-section">
          <p className="options-reason">
            <span className="options-reason-label">Pruned because:</span> {option.pruneReason || 'No reason given.'}
          </p>
        </div>
      )}

      {!editing && (
        <div className="card-section options-procon">
          <div>
            <h4 className="options-subhead">Pros</h4>
            {option.pros.length ? (
              <ul className="options-list">
                {option.pros.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            ) : (
              <p className="muted">None listed.</p>
            )}
          </div>
          <div>
            <h4 className="options-subhead">Cons</h4>
            {option.cons.length ? (
              <ul className="options-list">
                {option.cons.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            ) : (
              <p className="muted">None listed.</p>
            )}
          </div>
        </div>
      )}

      {!editing && <CriteriaList criteria={option.criteria} />}

      <div className="card-section stack options-score-section">
        {mine ? (
          <p className="muted">Not scored. You added this option.</p>
        ) : (
          <div className="options-score">
            <span className="options-subhead" id={`${headingId}-score`}>
              Rough score
            </span>
            <span className="options-bar" aria-hidden="true">
              <span className="options-bar-fill" style={{ width: `${option.score}%` }} />
            </span>
            <span className="tabular options-score-num" aria-describedby={`${headingId}-score`}>
              {option.score}
              <span className="visually-hidden"> out of 100</span>
            </span>
          </div>
        )}
        {evidence.length > 0 ? (
          <div className="stack options-evidence">
            <h4 className="options-subhead">Evidence</h4>
            <ul className="row options-chips">
              {evidence.map((c) => (
                <li key={c.id}>
                  <EvidenceChip item={c} />
                </li>
              ))}
            </ul>
          </div>
        ) : (
          !mine && <p className="muted options-evidence-none">No evidence from your brief backs this branch yet.</p>
        )}
      </div>

      <div className="card-section row options-card-actions">
        {!readOnly && !editing && !pruned && !blocked && (
          <button type="button" className="toggle" aria-pressed={chosen} onClick={onChoose}>
            {chosen ? 'Chosen branch' : 'Choose this branch'}
            <span className="visually-hidden">: {option.label}</span>
          </button>
        )}
        {!readOnly && !editing && (
          <button type="button" className="btn btn-ghost" onClick={() => setEditing(true)}>
            Edit<span className="visually-hidden"> {option.label}</span>
          </button>
        )}
        {!readOnly && !editing && !pruned && (
          <button type="button" className="btn btn-ghost" onClick={onPrune}>
            Prune<span className="visually-hidden"> {option.label}</span>
          </button>
        )}
        {subCount > 0 && (
          <button type="button" className="btn btn-ghost" onClick={onOpenSubs}>
            Sub-options ({subCount})<span className="visually-hidden"> of {option.label}</span>
          </button>
        )}
        {!readOnly && !editing && !pruned && !blocked && subCount === 0 && (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onBranchOut}
            disabled={branchBusy}
            aria-describedby={`${headingId}-split`}
          >
            {branching ? 'Branching out…' : 'Branch out'}
            <span className="visually-hidden"> {option.label}</span>
          </button>
        )}
        {!readOnly && pruned && (
          <button type="button" className="btn btn-secondary" onClick={onRestore}>
            Restore<span className="visually-hidden"> {option.label}</span>
          </button>
        )}
        {!mine && (
          <ReportWrongAnswer
            surface="option"
            targetId={option.id}
            decisionId={option.decisionId}
            excerpt={`${option.label}: ${option.summary}`}
          />
        )}
        {splitHint && !readOnly && subCount === 0 && !pruned && !blocked && (
          <p id={`${headingId}-split`} className="muted options-split-hint">
            Branch out splits this by {splitHint}.
          </p>
        )}
      </div>
    </li>
  );
}

const LEVEL_WORDS = ['', 'Very low', 'Low', 'Medium', 'High', 'Very high'];

function CriteriaList({ criteria }: { criteria?: Criteria }) {
  return (
    <div className="card-section stack">
      <h4 className="options-subhead">Rough ratings</h4>
      {criteria ? (
        <dl className="options-criteria">
          {CRITERIA.map((k) => {
            const v = criteria[k.key];
            return (
              <div key={k.key} className="options-criterion">
                <dt>
                  {k.label} <span className="muted options-criterion-hint">({k.hint.toLowerCase()})</span>
                </dt>
                <dd className="row">
                  <span className="options-pips" aria-hidden="true">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <span key={n} className={`options-pip${v && n <= v ? ' options-pip-on' : ''}`} />
                    ))}
                  </span>
                  <span className="tabular">{v ? `${LEVEL_WORDS[v]}, ${v} of 5` : 'Not rated'}</span>
                </dd>
              </div>
            );
          })}
        </dl>
      ) : (
        <p className="muted">Not rated yet. Edit the option to add ratings.</p>
      )}
    </div>
  );
}

function EvidenceChip({ item }: { item: ContextItem }) {
  const [open, setOpen] = useState(false);
  const tipId = useId();
  return (
    <span className="options-chip-wrap" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        className="chip options-chip"
        aria-describedby={tipId}
        aria-expanded={open}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && open) {
            e.stopPropagation();
            setOpen(false);
          }
        }}
      >
        {item.sourceLabel}
      </button>
      <span id={tipId} role="tooltip" className={`options-tip${open ? ' options-tip-open' : ''}`}>
        “{item.snippet}”<span className="options-tip-meta">{[item.author, item.date].filter(Boolean).join(', ')}</span>
      </span>
    </span>
  );
}

function OptionFields({
  prefix,
  label,
  setLabel,
  summary,
  setSummary,
  pros,
  setPros,
  cons,
  setCons,
  criteria,
  setCriteria,
  error,
}: {
  prefix: string;
  label: string;
  setLabel: (v: string) => void;
  summary: string;
  setSummary: (v: string) => void;
  pros: string;
  setPros: (v: string) => void;
  cons: string;
  setCons: (v: string) => void;
  criteria: Criteria;
  setCriteria: (v: Criteria) => void;
  error: string;
}) {
  return (
    <>
      <div className="field">
        <label htmlFor={`${prefix}-label`}>Option</label>
        <input
          id={`${prefix}-label`}
          className="input"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          aria-invalid={!!error}
          aria-describedby={error ? `${prefix}-error` : undefined}
        />
        {error && (
          <p id={`${prefix}-error`} className="error" role="alert">
            {error}
          </p>
        )}
      </div>
      <div className="field">
        <label htmlFor={`${prefix}-summary`}>Summary</label>
        <textarea
          id={`${prefix}-summary`}
          className="textarea"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
        />
      </div>
      <div className="grid-2">
        <div className="field">
          <label htmlFor={`${prefix}-pros`}>Pros</label>
          <span className="hint" id={`${prefix}-pros-hint`}>
            One per line
          </span>
          <textarea
            id={`${prefix}-pros`}
            className="textarea"
            value={pros}
            aria-describedby={`${prefix}-pros-hint`}
            onChange={(e) => setPros(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor={`${prefix}-cons`}>Cons</label>
          <span className="hint" id={`${prefix}-cons-hint`}>
            One per line
          </span>
          <textarea
            id={`${prefix}-cons`}
            className="textarea"
            value={cons}
            aria-describedby={`${prefix}-cons-hint`}
            onChange={(e) => setCons(e.target.value)}
          />
        </div>
      </div>
      <fieldset className="options-criteria-edit">
        <legend className="label">Rough ratings</legend>
        <div className="grid-2">
          {CRITERIA.map((k) => (
            <div key={k.key} className="field">
              <label htmlFor={`${prefix}-${k.key}`}>{k.label}</label>
              <select
                id={`${prefix}-${k.key}`}
                className="select"
                value={criteria[k.key] ?? ''}
                aria-describedby={`${prefix}-${k.key}-hint`}
                onChange={(e) => setCriteria(withRating(criteria, k.key, e.target.value))}
              >
                <option value="">Not rated</option>
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n} of 5
                  </option>
                ))}
              </select>
              <span className="hint" id={`${prefix}-${k.key}-hint`}>
                {k.hint}
              </span>
            </div>
          ))}
        </div>
      </fieldset>
    </>
  );
}

function withRating(criteria: Criteria, key: CriterionKey, value: string): Criteria {
  const next = { ...criteria };
  if (value) next[key] = Number(value);
  else delete next[key];
  return next;
}

function OptionEditForm({
  option,
  onSave,
  onCancel,
}: {
  option: OptionNode;
  onSave: (patch: Partial<OptionNode>) => void;
  onCancel: () => void;
}) {
  const prefix = `edit-${option.id}`;
  const [label, setLabel] = useState(option.label);
  const [summary, setSummary] = useState(option.summary);
  const [pros, setPros] = useState(option.pros.join('\n'));
  const [cons, setCons] = useState(option.cons.join('\n'));
  const [criteria, setCriteria] = useState<Criteria>(option.criteria ?? {});
  const [error, setError] = useState('');

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!label.trim()) {
      setError('Give the option a name.');
      return;
    }
    onSave({
      label: label.trim(),
      summary: summary.trim(),
      pros: lines(pros),
      cons: lines(cons),
      criteria: Object.keys(criteria).length ? criteria : undefined,
    });
  }

  return (
    <form className="stack" onSubmit={submit} aria-label={`Edit ${option.label}`}>
      <OptionFields
        {...{
          prefix,
          label,
          setLabel,
          summary,
          setSummary,
          pros,
          setPros,
          cons,
          setCons,
          criteria,
          setCriteria,
          error,
        }}
      />
      <div className="row">
        <button type="submit" className="btn">
          Save changes
        </button>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function AddOptionForm({ parent, onAdd }: { parent?: OptionNode; onAdd: (o: OptionNode) => void }) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [summary, setSummary] = useState('');
  const [pros, setPros] = useState('');
  const [cons, setCons] = useState('');
  const [criteria, setCriteria] = useState<Criteria>({});
  const [error, setError] = useState('');
  const title = parent ? `Add your own sub-option to “${parent.label}”` : 'Add your own option';

  function reset() {
    setLabel('');
    setSummary('');
    setPros('');
    setCons('');
    setCriteria({});
    setError('');
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!label.trim()) {
      setError('Give the option a name.');
      return;
    }
    onAdd({
      id: newId('o-user'),
      decisionId: '',
      parentId: null,
      label: label.trim(),
      summary: summary.trim(),
      pros: lines(pros),
      cons: lines(cons),
      score: 0,
      criteria: Object.keys(criteria).length ? criteria : undefined,
      contextIds: [],
      state: 'open',
    });
    reset();
    setOpen(false);
  }

  if (!open) {
    return (
      <div>
        <button type="button" className="btn btn-secondary" onClick={() => setOpen(true)}>
          {parent ? 'Add your own sub-option' : 'Add your own option'}
        </button>
      </div>
    );
  }

  return (
    <section className="card" aria-labelledby="options-add-title">
      <form className="card-section stack" onSubmit={submit}>
        <h2 id="options-add-title" className="section-title">
          {title}
        </h2>
        <OptionFields
          {...{
            prefix: 'options-add',
            label,
            setLabel,
            summary,
            setSummary,
            pros,
            setPros,
            cons,
            setCons,
            criteria,
            setCriteria,
            error,
          }}
        />
        <div className="row">
          <button type="submit" className="btn">
            Add option
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              reset();
              setOpen(false);
            }}
          >
            Cancel
          </button>
        </div>
      </form>
    </section>
  );
}

function PruneDialog({
  option,
  onClose,
  onPrune,
}: {
  option: OptionNode | null;
  onClose: () => void;
  onPrune: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setReason('');
    setError('');
  }, [option?.id]);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!reason.trim()) {
      setError('Add a reason. Pruned branches keep their reason so you can trace the call later.');
      return;
    }
    onPrune(reason.trim());
  }

  return (
    <Dialog open={!!option} onClose={onClose} title={option ? `Prune “${option.label}”` : 'Prune option'}>
      <form className="stack" onSubmit={submit} noValidate>
        <p className="muted">The branch stays on the page with your reason. You can restore it any time.</p>
        <div className="field">
          <label htmlFor="options-prune-reason">Why are you pruning this branch?</label>
          <textarea
            id="options-prune-reason"
            className="textarea"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
            aria-invalid={!!error}
            aria-describedby={error ? 'options-prune-error' : undefined}
          />
          {error && (
            <p id="options-prune-error" className="error" role="alert">
              {error}
            </p>
          )}
        </div>
        <div className="row">
          <button type="submit" className="btn">
            Prune branch
          </button>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </Dialog>
  );
}
