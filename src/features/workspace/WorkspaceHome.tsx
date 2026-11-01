// The one main page. It shows the whole decision map — every logged call, the
// ones in flight, and the directions still open — and lets the PM step into any
// of them. Selecting a node opens an inspector with the reasoning behind it, what
// it built on, and what it led to. This is where "trace a decision to its root"
// becomes something you can see.
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../../store/store';
import { continuePath } from '../log/format';
import { formatDate } from '../log/format';
import { IconArrowRight, IconPlay, IconPlus } from '../../components/icons';
import type { Decision } from '../../types';
import { ForestCanvas } from './ForestCanvas';
import './workspace.css';

export function WorkspaceHome() {
  const { state, dispatch } = useStore();
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const decisions = state.decisions;

  const counts = useMemo(() => {
    let decided = 0;
    let progress = 0;
    let directions = 0;
    for (const d of decisions) {
      if (d.speculative || d.horizon === 'future') directions++;
      else if (d.status === 'decided') decided++;
      else progress++;
    }
    return { decided, progress, directions };
  }, [decisions]);

  const selected = decisions.find((d) => d.id === selectedId);

  if (decisions.length === 0) {
    return (
      <div className="page wk-empty">
        <p className="kicker">Workspace</p>
        <h1 className="page-title">Start with one decision.</h1>
        <p className="lead">
          Rooted maps your options, keeps the ones you pruned with their reasons, and traces every call back to the
          evidence behind it. Frame your first decision, or load a worked example to see where it goes.
        </p>
        <div className="row">
          <Link to="/decisions/new" className="btn btn-lg">
            <IconPlus /> Frame your first decision
          </Link>
          <button
            type="button"
            className="btn btn-secondary btn-lg"
            onClick={() => dispatch({ type: 'loadDemo' })}
          >
            <IconPlay /> Explore the demo
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page wk-home">
      <header className="wk-head">
        <div className="wk-head-text">
          <p className="kicker">{state.demo ? 'Demo workspace' : 'Workspace'}</p>
          <h1 className="page-title">
            {state.demo ? 'Fernwave’s decision map' : 'Your decision map'}
          </h1>
          <p className="lead">
            Every decision, traced to its root. Read it left to right: the calls you’ve made, what they led to, and the
            directions still open. Select any node to see the reasoning behind it.
          </p>
        </div>
        <dl className="wk-stats" aria-label="Decision counts">
          <div className="wk-stat">
            <dt>Decided</dt>
            <dd className="tabular">{counts.decided}</dd>
          </div>
          <div className="wk-stat">
            <dt>In progress</dt>
            <dd className="tabular">{counts.progress}</dd>
          </div>
          <div className="wk-stat">
            <dt>Directions</dt>
            <dd className="tabular">{counts.directions}</dd>
          </div>
        </dl>
      </header>

      <div className="wk-canvas-wrap">
        <section className="card wk-forest" aria-label="Decision map">
          <ForestCanvas
            decisions={decisions}
            options={state.options}
            selectedId={selectedId}
            onSelect={(id) => setSelectedId((cur) => (cur === id ? undefined : id))}
          />
        </section>

        <aside className="wk-inspector" aria-label="Decision detail">
          {selected ? (
            <DecisionDetail decision={selected} onSelect={setSelectedId} />
          ) : (
            <MapLegend demo={state.demo} />
          )}
        </aside>
      </div>
    </div>
  );
}

function MapLegend({ demo }: { demo: boolean }) {
  return (
    <div className="card wk-legend">
      <div className="card-section stack">
        <h2 className="section-title">How to read the map</h2>
        <ul className="wk-legend-list">
          <li>
            <span className="dot dot-chosen" aria-hidden="true" /> A decision you made, with the branch you chose.
          </li>
          <li>
            <span className="dot dot-alive" aria-hidden="true" /> A decision in progress.
          </li>
          <li>
            <span className="dot dot-pruned" aria-hidden="true" /> A direction to explore — not committed to.
          </li>
        </ul>
        <p className="muted">
          Lines run from a decision to the ones it built on. {demo
            ? 'This is planted sample data so you can see a full history at a glance.'
            : 'Select a node to open it and see the evidence, options and reasoning.'}
        </p>
      </div>
    </div>
  );
}

function DecisionDetail({
  decision,
  onSelect,
}: {
  decision: Decision;
  onSelect: (id: string) => void;
}) {
  const { state } = useStore();
  const kind = decision.speculative || decision.horizon === 'future' ? 'future' : decision.status === 'decided' ? 'decided' : 'open';
  const chosen = state.options.find((o) => o.id === decision.chosenOptionId);
  const builtOn = (decision.builtOn ?? [])
    .map((id) => state.decisions.find((d) => d.id === id))
    .filter((d): d is Decision => !!d);
  const leadsTo = state.decisions.filter((d) => (d.builtOn ?? []).includes(decision.id));
  const paths = state.options.filter((o) => o.decisionId === decision.id && o.parentId === null);

  return (
    <div className="card wk-detail">
      <div className="card-section stack">
        <div className="row wk-detail-tags">
          <span className={`pill ${kind === 'decided' ? 'pill-rec' : ''}`}>
            <span
              className={`dot ${kind === 'decided' ? 'dot-chosen' : kind === 'future' ? 'dot-pruned' : 'dot-alive'}`}
              aria-hidden="true"
            />
            {kind === 'decided' ? 'Decided' : kind === 'future' ? 'Direction' : 'In progress'}
          </span>
          {decision.metric && <span className="pill">{decision.metric}</span>}
        </div>
        <h2 className="section-title">{decision.question}</h2>
        {decision.notes && <p className="wk-detail-notes">{decision.notes}</p>}
      </div>

      {kind === 'decided' && (
        <div className="card-section stack">
          {chosen && (
            <p className="wk-detail-chose">
              <span className="wk-detail-label">Chose</span> {chosen.label}
            </p>
          )}
          {decision.rationale && <p className="wk-detail-why">{decision.rationale}</p>}
          {decision.outcome && (
            <div className="wk-outcome">
              <span className="wk-detail-label">What happened</span>
              <p>{decision.outcome.result}</p>
              {decision.outcome.metrics && <p className="wk-outcome-metric tabular">{decision.outcome.metrics}</p>}
            </div>
          )}
        </div>
      )}

      {kind === 'future' && paths.length > 0 && (
        <div className="card-section stack">
          <span className="wk-detail-label">Possible paths</span>
          <ul className="wk-paths">
            {paths.map((p) => (
              <li key={p.id}>
                <span className="dot dot-alive" aria-hidden="true" /> {p.label}
              </li>
            ))}
          </ul>
          <p className="muted">A planted direction. Step in to weigh these paths without committing.</p>
        </div>
      )}

      {(builtOn.length > 0 || leadsTo.length > 0) && (
        <div className="card-section stack wk-links">
          {builtOn.length > 0 && (
            <div className="stack wk-links-group">
              <span className="wk-detail-label">Builds on</span>
              {builtOn.map((d) => (
                <button key={d.id} type="button" className="wk-link-btn" onClick={() => onSelect(d.id)}>
                  <span className="dot dot-chosen" aria-hidden="true" />
                  {d.question}
                </button>
              ))}
            </div>
          )}
          {leadsTo.length > 0 && (
            <div className="stack wk-links-group">
              <span className="wk-detail-label">Leads to</span>
              {leadsTo.map((d) => (
                <button key={d.id} type="button" className="wk-link-btn" onClick={() => onSelect(d.id)}>
                  <span
                    className={`dot ${d.speculative ? 'dot-pruned' : d.status === 'decided' ? 'dot-chosen' : 'dot-alive'}`}
                    aria-hidden="true"
                  />
                  {d.question}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="card-section row wk-detail-actions">
        {kind === 'future' ? (
          <Link to={`/decisions/${decision.id}/options`} className="btn">
            Explore this direction <IconArrowRight />
          </Link>
        ) : kind === 'decided' ? (
          <Link to={`/decisions/${decision.id}`} className="btn">
            Open the record <IconArrowRight />
          </Link>
        ) : (
          <Link to={continuePath(decision)} className="btn">
            Continue <IconArrowRight />
          </Link>
        )}
        {decision.reviewDate && kind !== 'future' && (
          <span className="muted">Review {formatDate(decision.reviewDate)}</span>
        )}
      </div>
    </div>
  );
}
