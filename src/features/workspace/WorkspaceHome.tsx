// The one main page: a full-bleed decision canvas. The map is the product — pan,
// zoom, drag and arrange decisions; switch between a free graph and a timeline;
// scope to yourself or the org; colour-code; trace a decision's lineage; rename.
// Text is kept to labels and the selected node's detail — the canvas does the talking.
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useStore } from '../../store/store';
import { orgDecisions } from '../../data/orgFixtures';
import { continuePath } from '../log/format';
import { IconArrowRight, IconGraph, IconPlus, IconSidebar, IconTimeline, IconTrace } from '../../components/icons';
import type { Decision } from '../../types';
import { MapCanvas } from './MapCanvas';
import { categoryColor, lineage, type MapNode } from './map';
import './workspace.css';

type View = 'graph' | 'timeline';
type Scope = 'me' | 'org';
type ColorBy = 'status' | 'metric' | 'owner';

const STATUS_COLOR: Record<MapNode['kind'], string> = {
  decided: 'var(--rec-bg)',
  open: 'var(--sage)',
  future: 'var(--berry)',
};

export function WorkspaceHome() {
  const { state, dispatch } = useStore();
  const navigate = useNavigate();
  const me = state.user?.name ?? 'You';

  const [view, setView] = useState<View>('graph');
  const [scope, setScope] = useState<Scope>('me');
  const [colorBy, setColorBy] = useState<ColorBy>('status');
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [traceOn, setTraceOn] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);

  const toNode = (d: Decision): MapNode => ({
    id: d.id,
    question: d.question,
    kind: d.speculative || d.horizon === 'future' ? 'future' : d.status === 'decided' ? 'decided' : 'open',
    status: d.status,
    metric: d.metric,
    owner: d.owner ?? me,
    chosen: state.options.find((o) => o.id === d.chosenOptionId)?.label,
    builtOn: d.builtOn ?? [],
    external: !!d.owner,
  });

  const nodes = useMemo(() => {
    const own = state.decisions.map(toNode);
    if (scope === 'me') return own;
    return [...own, ...orgDecisions.map(toNode)];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.decisions, state.options, scope, me]);

  const metrics = useMemo(() => [...new Set(nodes.map((n) => n.metric).filter(Boolean) as string[])].sort(), [nodes]);
  const owners = useMemo(() => [...new Set(nodes.map((n) => n.owner))].sort(), [nodes]);

  const colorOf = (n: MapNode): string => {
    if (colorBy === 'metric') return n.metric ? categoryColor(n.metric, metrics) : 'var(--ink2)';
    if (colorBy === 'owner') return categoryColor(n.owner, owners);
    return STATUS_COLOR[n.kind];
  };

  const traceSet = traceOn && selectedId ? lineage(nodes, selectedId) : null;
  const selected = nodes.find((n) => n.id === selectedId);
  const legend = colorBy === 'metric' ? metrics : colorBy === 'owner' ? owners : [];

  function select(id: string | null) {
    setSelectedId(id ?? undefined);
    if (id) setPanelOpen(true);
    else setTraceOn(false);
  }

  if (nodes.length === 0) {
    return (
      <div className="map-empty">
        <div className="map-empty-inner">
          <h1 className="page-title">Start with one decision.</h1>
          <div className="row">
            <Link to="/decisions/new" className="btn btn-lg">
              <IconPlus /> Frame your first decision
            </Link>
            <button type="button" className="btn btn-secondary btn-lg" onClick={() => dispatch({ type: 'loadDemo' })}>
              Explore the demo
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="map-page">
      <h1 className="visually-hidden">Decision map</h1>

      <MapCanvas
        nodes={nodes}
        view={view}
        scope={scope}
        colorOf={colorOf}
        selectedId={selectedId}
        traceSet={traceSet}
        onSelect={select}
        onOpen={(id) => {
          const d = state.decisions.find((x) => x.id === id);
          if (d) navigate(d.speculative ? `/decisions/${id}/options` : continuePath(d));
        }}
      />

      <div className="map-toolbar" role="toolbar" aria-label="Map controls">
        <Segmented
          label="View"
          value={view}
          onChange={(v) => setView(v as View)}
          options={[
            { value: 'graph', label: 'Graph', icon: <IconGraph size={15} /> },
            { value: 'timeline', label: 'Timeline', icon: <IconTimeline size={15} /> },
          ]}
        />
        <Segmented
          label="Scope"
          value={scope}
          onChange={(v) => setScope(v as Scope)}
          options={[
            { value: 'me', label: 'Me' },
            { value: 'org', label: 'Org' },
          ]}
        />
        <label className="map-colorby">
          <span className="visually-hidden">Colour by</span>
          <select className="map-select" value={colorBy} onChange={(e) => setColorBy(e.target.value as ColorBy)}>
            <option value="status">Colour: status</option>
            <option value="metric">Colour: goal</option>
            <option value="owner">Colour: owner</option>
          </select>
        </label>
        <button
          type="button"
          className={`map-tool-btn${traceOn ? ' map-tool-btn-on' : ''}`}
          aria-pressed={traceOn}
          disabled={!selectedId}
          onClick={() => setTraceOn((v) => !v)}
          title={selectedId ? 'Trace this decision’s lineage' : 'Select a node first'}
        >
          <IconTrace size={15} /> Trace
        </button>
        <button
          type="button"
          className={`map-tool-btn${panelOpen ? ' map-tool-btn-on' : ''}`}
          aria-pressed={panelOpen}
          onClick={() => setPanelOpen((v) => !v)}
          title="Toggle the detail panel"
        >
          <IconSidebar size={15} /> Details
        </button>
      </div>

      {legend.length > 0 && (
        <div className="map-legend" aria-hidden="true">
          {legend.map((v) => (
            <span key={v} className="map-legend-item">
              <span className="map-legend-dot" style={{ background: categoryColor(v, legend) }} />
              {v}
            </span>
          ))}
        </div>
      )}

      {scope === 'org' && <span className="map-scope-note">Org view · sample data</span>}

      {panelOpen && selected && (
        <DetailPanel node={selected} nodes={nodes} onSelect={select} onClose={() => setPanelOpen(false)} />
      )}
    </div>
  );
}

function Segmented({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string; icon?: React.ReactNode }[];
}) {
  return (
    <div className="map-seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className={`map-seg-btn${value === o.value ? ' map-seg-btn-on' : ''}`}
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}

function DetailPanel({
  node,
  nodes,
  onSelect,
  onClose,
}: {
  node: MapNode;
  nodes: MapNode[];
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const { state, dispatch } = useStore();
  const decision = state.decisions.find((d) => d.id === node.id);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(node.question);

  const builtOn = node.builtOn.map((id) => nodes.find((n) => n.id === id)).filter((n): n is MapNode => !!n);
  const leadsTo = nodes.filter((n) => n.builtOn.includes(node.id));
  const kindLabel = node.kind === 'decided' ? 'Decided' : node.kind === 'future' ? 'Direction' : 'In progress';

  function saveTitle() {
    if (decision && title.trim() && title.trim() !== node.question) {
      dispatch({ type: 'updateDecision', decisionId: node.id, patch: { question: title.trim() } });
    }
    setEditing(false);
  }

  return (
    <aside className="map-inspector" aria-label="Decision detail">
      <div className="map-inspector-head">
        <div className="row map-inspector-tags">
          <span className={`pill ${node.kind === 'decided' ? 'pill-rec' : ''}`}>
            <span className="map-dot" style={{ background: STATUS_COLOR[node.kind] }} aria-hidden="true" />
            {kindLabel}
          </span>
          {node.metric && <span className="pill">{node.metric}</span>}
          {node.external && <span className="pill">{node.owner}</span>}
        </div>
        <button type="button" className="shell-icon-btn" aria-label="Close details" onClick={onClose}>
          <span aria-hidden="true">×</span>
        </button>
      </div>

      {editing ? (
        <form
          className="map-rename"
          onSubmit={(e) => {
            e.preventDefault();
            saveTitle();
          }}
        >
          <label htmlFor="map-rename-input" className="visually-hidden">
            Rename decision
          </label>
          <input
            id="map-rename-input"
            className="input"
            value={title}
            autoFocus
            onChange={(e) => setTitle(e.target.value)}
            onBlur={saveTitle}
          />
          <button type="submit" className="btn">
            Save
          </button>
        </form>
      ) : (
        <h2 className="map-inspector-title">
          {node.question}
          {!node.external && (
            <button type="button" className="map-rename-btn" aria-label="Rename decision" onClick={() => { setTitle(node.question); setEditing(true); }}>
              Rename
            </button>
          )}
        </h2>
      )}

      {node.kind === 'decided' && node.chosen && (
        <p className="map-inspector-chose">
          <span className="map-inspector-label">Chose</span> {node.chosen}
        </p>
      )}
      {decision?.rationale && node.kind === 'decided' && <p className="map-inspector-why">{decision.rationale}</p>}
      {decision?.outcome?.metrics && <p className="map-inspector-metric tabular">{decision.outcome.metrics}</p>}
      {node.kind !== 'decided' && decision?.notes && <p className="map-inspector-why">{decision.notes}</p>}

      {(builtOn.length > 0 || leadsTo.length > 0) && (
        <div className="map-links">
          {builtOn.length > 0 && (
            <div className="map-links-group">
              <span className="map-inspector-label">Builds on</span>
              {builtOn.map((n) => (
                <button key={n.id} type="button" className="map-link-chip" onClick={() => onSelect(n.id)}>
                  {n.question}
                </button>
              ))}
            </div>
          )}
          {leadsTo.length > 0 && (
            <div className="map-links-group">
              <span className="map-inspector-label">Leads to</span>
              {leadsTo.map((n) => (
                <button key={n.id} type="button" className="map-link-chip" onClick={() => onSelect(n.id)}>
                  {n.question}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {!node.external && (
        <div className="map-inspector-actions">
          {node.kind === 'future' ? (
            <Link to={`/decisions/${node.id}/options`} className="btn">
              Explore <IconArrowRight size={16} />
            </Link>
          ) : node.kind === 'decided' ? (
            <Link to={`/decisions/${node.id}`} className="btn">
              Open record <IconArrowRight size={16} />
            </Link>
          ) : (
            decision && (
              <Link to={continuePath(decision)} className="btn">
                Continue <IconArrowRight size={16} />
              </Link>
            )
          )}
        </div>
      )}
    </aside>
  );
}
