// F-17, F-19: the decision map. In Tree (the default, decision 0019), linked
// decisions read left to right as branches, one tree per thread, and cards can
// be dragged; where you put them is remembered per scope. In Timeline, each
// card is placed by when it was made, in a swimlane. Solid lines are links the
// team made ("builds on"); dashed sage lines are connections Rooted found, until
// someone accepts or dismisses them. Wine marks only the chosen option on each
// card. Picking a decision lights up its lineage: what it built on and led to.
import {
  Background,
  ControlButton,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  useViewport,
  BackgroundVariant,
  type Edge,
  type Node,
  type NodeChange,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { personColor } from '../../components/Avatar';
import { formatDate } from '../log/format';
import {
  chosenLabel,
  decisionDate,
  goalOf,
  MAP_STATUS_LABEL,
  mapStatus,
  ownerOf,
  visibleLinks,
  type MapStatus,
} from '../../store/dashboard';
import type { AppState, Decision } from '../../types';
import { lineage, treeLayout, type GraphEdge } from './graphLayout';
import { loadPositions, savePositions, type Positions } from './positions';
import { LANE_LABEL_W, layoutMap, NODE_H, NODE_W, STANDALONE, threadOf, type LaneBy } from './mapLayout';

export type MapLayoutMode = 'tree' | 'timeline';
export type ColorBy = 'status' | 'goal' | 'owner';

export { goalOf };

const GOAL_COLORS = 6;
export const OTHER_GOAL = 'Other';
const OTHER_COLOR = 'var(--ink2)';

/**
 * Colors for "Color by goal": the six most common goals get a muted token
 * (--goal-1…6) each, and the rest share a neutral "Other", so no two goals in
 * the legend look alike.
 */
export function goalPalette(decisions: Decision[]): { colorOf: (goal?: string) => string; legend: { label: string; color: string }[] } {
  const counts = new Map<string, number>();
  for (const d of decisions) {
    const g = goalOf(d);
    if (g) counts.set(g, (counts.get(g) ?? 0) + 1);
  }
  const ranked = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([g]) => g);
  const top = new Map(ranked.slice(0, GOAL_COLORS).map((g, i) => [g, `var(--goal-${i + 1})`]));
  const legend = [...top].map(([label, color]) => ({ label, color }));
  if (ranked.length > GOAL_COLORS) legend.push({ label: OTHER_GOAL, color: OTHER_COLOR });
  return { colorOf: (g) => (g ? (top.get(g) ?? OTHER_COLOR) : 'var(--card-border)'), legend };
}


interface DecisionData extends Record<string, unknown> {
  decision: Decision;
  status: MapStatus;
  chosen?: string;
  initials: string;
  ownerName: string;
  ownerColor: string;
  dimmed: boolean;
  faded: boolean; // a decision is picked and this one isn't connected to it
  matched: boolean;
  highlighted: boolean;
  traced: boolean; // on the picked decision's lineage
  accent?: string; // card color when coloring by goal or owner; status colors come from the stylesheet
  goal?: string; // shown on the card when coloring by goal, so color isn't the only cue
  simple: boolean; // the quiet default card: a status dot, the question, the choice — nothing else
  onOpen: (id: string) => void;
}

function DecisionNode({ data, selected }: NodeProps<Node<DecisionData>>) {
  const d = data.decision;
  const cls = [
    'map-node',
    `map-node-${data.status}`,
    selected ? 'map-node-selected' : '',
    data.dimmed ? 'map-node-dimmed' : '',
    data.faded ? 'map-node-faded' : '',
    data.matched ? 'map-node-match' : '',
    data.highlighted ? 'map-node-highlighted' : '',
    data.traced ? 'map-node-traced' : '',
    d.speculative ? 'map-node-speculative' : '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <div
      className={cls}
      style={{ width: NODE_W, height: NODE_H, ...(data.accent ? { '--node-accent': data.accent } : {}) } as CSSProperties}
    >
      <Handle type="target" id="left" position={Position.Left} isConnectable={false} className="map-handle" />
      {/* In Graph, links can arrive and leave on any side. */}
      <Handle type="target" id="in-right" position={Position.Right} isConnectable={false} className="map-handle" />
      <Handle type="target" id="in-top" position={Position.Top} isConnectable={false} className="map-handle" />
      <Handle type="target" id="in-bottom" position={Position.Bottom} isConnectable={false} className="map-handle" />
      <Handle type="source" id="out-left" position={Position.Left} isConnectable={false} className="map-handle" />
      <Handle type="source" id="out-top" position={Position.Top} isConnectable={false} className="map-handle" />
      <Handle type="source" id="out-bottom" position={Position.Bottom} isConnectable={false} className="map-handle" />
      {/* Elbows leave near the left edge, so a follow-up hangs off its parent like an indented outline. */}
      <Handle type="source" id="top" position={Position.Top} isConnectable={false} className="map-handle map-handle-elbow" />
      <button
        type="button"
        className="map-node-hit"
        aria-label={`${d.question}, ${d.speculative ? 'direction to explore' : MAP_STATUS_LABEL[data.status]}${data.traced && !selected ? ', on the picked decision’s path' : ''}`}
        aria-pressed={!!selected}
        onClick={() => data.onOpen(d.id)}
      />
      {data.simple ? (
        // The quiet default: the status (dot + word), the question, and the choice.
        // The date, owner and goal wait behind the Details toggle. Status still pairs
        // colour with a word, and the choice keeps its wine dot, per design-language.
        <>
          <p className="map-node-meta" aria-hidden="true">
            <span className={`map-dot map-dot-${data.status}`} aria-hidden="true" />
            <span className={data.status === 'outcome-due' ? 'due-label' : undefined}>
              {d.speculative ? 'Direction to explore' : MAP_STATUS_LABEL[data.status]}
            </span>
          </p>
          <p className="map-node-q" aria-hidden="true">
            {d.question}
          </p>
          {data.chosen ? (
            <span className="map-node-chosen map-node-chosen-plain" aria-hidden="true">
              <span className="dot dot-chosen" aria-hidden="true" />
              {data.chosen}
            </span>
          ) : (
            <span className="muted map-node-chosen-plain map-node-chosen" aria-hidden="true">
              {d.speculative ? '' : data.status === 'open' ? 'Not decided yet' : d.summary}
            </span>
          )}
        </>
      ) : (
        <>
          <p className="map-node-meta" aria-hidden="true">
            <span className={`map-dot map-dot-${data.status}`} aria-hidden="true" />
            <span className={data.status === 'outcome-due' ? 'due-label' : undefined}>
              {d.speculative ? 'Direction to explore' : MAP_STATUS_LABEL[data.status]}
            </span>
            <span aria-hidden="true">·</span>
            <span className="tabular">{formatDate(decisionDate(d))}</span>
            {(data.goal ?? d.metric) && <span className="map-node-metric">{data.goal ?? d.metric}</span>}
          </p>
          <p className="map-node-q" aria-hidden="true">
            {d.question}
          </p>
          <div className="map-node-foot" aria-hidden="true">
            <span className="avatar" title={data.ownerName} style={{ '--person': data.ownerColor } as CSSProperties}>
              {data.initials}
            </span>
            {data.chosen ? (
              <span className="map-node-chosen">
                <span className="dot dot-chosen" aria-hidden="true" />
                <span className="visually-hidden">Chose: </span>
                {data.chosen}
              </span>
            ) : (
              <span className="muted map-node-undecided map-node-chosen">{data.status === 'open' ? 'Not decided yet' : d.summary}</span>
            )}
          </div>
        </>
      )}
      <Handle type="source" id="right" position={Position.Right} isConnectable={false} className="map-handle" />
      <Handle type="source" id="bottom" position={Position.Bottom} isConnectable={false} className="map-handle map-handle-elbow" />
    </div>
  );
}

function LaneNode({ data }: NodeProps<Node<{ width: number; height: number; shaded: boolean }>>) {
  return (
    <div
      className={data.shaded ? 'map-lane map-lane-shaded' : 'map-lane'}
      style={{ width: data.width, height: data.height }}
    />
  );
}

// Lane names stay pinned to the left edge while the map pans sideways.
function LaneLabels({ lanes }: { lanes: { key: string; y: number; count: number; color?: string }[] }) {
  const { y, zoom } = useViewport();
  return (
    <div className="map-lane-labels" aria-hidden="true">
      {lanes.map((lane) => (
        <span key={lane.key} className="map-lane-label" style={{ top: lane.y * zoom + y }}>
          {lane.color && <span className="map-lane-swatch" style={{ background: lane.color }} />}
          {lane.key}
          <span className="map-lane-count tabular">{lane.count}</span>
        </span>
      ))}
    </div>
  );
}

// Below this zoom the cards are hard to read, so the map opens on the newest decisions instead of fitting all.
const READABLE_ZOOM = 0.75;
const OPENING_ZOOM = 0.9;
// Tree: fit everything when it stays this legible, else open on the first tree at this zoom.
const TREE_FIT_ZOOM = 0.62;
const TREE_OPEN_ZOOM = 0.8;

function MonthNode({ data }: NodeProps<Node<{ label: string }>>) {
  return <span className="map-month">{data.label}</span>;
}

// The name of one tree on the map (its thread), or the unlinked decisions.
function GroupNode({ data }: NodeProps<Node<{ label: string; count: number }>>) {
  return (
    <span className="map-group">
      {data.label}
      <span className="map-group-count tabular">{data.count}</span>
    </span>
  );
}

const nodeTypes = { decision: DecisionNode, lane: LaneNode, month: MonthNode, treeLabel: GroupNode };
const GROUP_LABEL_H = 36;

export interface DecisionMapProps {
  state: AppState;
  decisions: Decision[]; // already filtered
  mode: MapLayoutMode;
  laneBy: LaneBy;
  colorBy: ColorBy;
  detailed: boolean; // full node cards (power users); off = the quiet default
  positionsKey: string; // which saved arrangement to use, e.g. the "who" filter
  today: string;
  selectedId?: string;
  matchIds: Set<string> | null; // search matches; null when not searching
  highlightIds: string[];
  onSelect: (id: string | undefined) => void;
}

export function DecisionMap(props: DecisionMapProps) {
  return (
    <ReactFlowProvider>
      <MapInner {...props} />
    </ReactFlowProvider>
  );
}

function MapInner({
  state,
  decisions,
  mode,
  laneBy,
  colorBy,
  detailed,
  positionsKey,
  today,
  selectedId,
  matchIds,
  highlightIds,
  onSelect,
}: DecisionMapProps) {
  const flow = useReactFlow();
  const canvas = useRef<HTMLDivElement>(null);
  const tree = mode === 'tree';
  const timeline = useMemo(() => layoutMap(decisions, laneBy, state, today), [decisions, laneBy, state, today]);
  const [hoverId, setHoverId] = useState<string | undefined>(undefined);

  const links = useMemo(() => {
    const shown = new Set(decisions.map((d) => d.id));
    return visibleLinks(state).filter((l) => shown.has(l.fromId) && shown.has(l.toId));
  }, [decisions, state]);
  // The tree and lineage follow links the team made or accepted, not ones Rooted only suggested.
  const confirmed = useMemo<GraphEdge[]>(
    () => links.filter((l) => l.status === 'accepted').map((l) => ({ from: l.fromId, to: l.toId })),
    [links],
  );
  // Picking a decision lights up its whole lineage: everything it built on and everything it led to.
  const traced = useMemo(() => (selectedId ? lineage(confirmed, selectedId) : null), [selectedId, confirmed]);

  // Tree: the layered layout, with any card the PM dragged where they left it.
  const [custom, setCustom] = useState<Positions>(() => loadPositions(positionsKey));
  useEffect(() => setCustom(loadPositions(positionsKey)), [positionsKey]);
  const branches = useMemo(() => {
    if (!tree) return null;
    const oldestFirst = [...decisions].sort((a, b) => decisionDate(a).localeCompare(decisionDate(b)) || a.id.localeCompare(b.id));
    return treeLayout(oldestFirst.map((d) => d.id), confirmed, { nodeW: NODE_W, nodeH: NODE_H });
  }, [tree, decisions, confirmed]);
  const layout = useMemo(() => {
    if (!branches) return timeline;
    const placed = timeline.placed.map((p) => {
      const at = custom[p.decision.id] ?? branches.pos.get(p.decision.id) ?? { x: 0, y: 0 };
      return { ...p, x: at.x, y: at.y };
    });
    return { ...timeline, placed, lanes: [], months: [], width: branches.width, height: branches.height };
  }, [branches, timeline, custom]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      if (!tree) return;
      const moved = changes.filter((c) => c.type === 'position' && c.position);
      if (moved.length === 0) return;
      setCustom((prev) => {
        const next = { ...prev };
        for (const c of moved) if (c.type === 'position' && c.position) next[c.id] = c.position;
        return next;
      });
    },
    [tree],
  );
  const onNodeDragStop = useCallback(
    (_: unknown, node: Node) => {
      setCustom((prev) => {
        const next = { ...prev, [node.id]: node.position };
        savePositions(positionsKey, next);
        return next;
      });
    },
    [positionsKey],
  );
  function tidy() {
    setCustom({});
    savePositions(positionsKey, {});
  }
  const moved = tree && Object.keys(custom).some((id) => decisions.some((d) => d.id === id));

  const palette = useMemo(() => goalPalette(decisions), [decisions]);

  // What stays bright when a decision is picked: its lineage, plus any connection Rooted suggested for it.
  const neighbors = useMemo(() => {
    if (!selectedId || !traced) return null;
    const ids = new Set(traced);
    for (const l of links) {
      if (l.fromId === selectedId) ids.add(l.toId);
      if (l.toId === selectedId) ids.add(l.fromId);
    }
    return ids;
  }, [links, selectedId, traced]);

  const nodes = useMemo<Node[]>(() => {
    const laneNodes: Node[] = layout.lanes.map((lane, i) => ({
      id: `lane-${lane.key}`,
      type: 'lane',
      position: { x: 0, y: lane.y },
      data: { width: layout.width + 40, height: lane.height, shaded: i % 2 === 1 },
      selectable: false,
      draggable: false,
      focusable: false,
      zIndex: -1,
    }));
    const monthNodes: Node[] = layout.months.map((m) => ({
      id: `month-${m.label}`,
      type: 'month',
      position: { x: m.x, y: -32 },
      data: { label: m.label },
      selectable: false,
      draggable: false,
      focusable: false,
    }));
    const byId = new Map(decisions.map((d) => [d.id, d]));
    const groupNodes: Node[] = (branches?.groups ?? []).map((g, i) => ({
      id: `tree-label-${i}`,
      type: 'treeLabel',
      position: { x: g.x, y: g.y - GROUP_LABEL_H },
      data: { label: g.loose ? STANDALONE : threadOf(byId.get(g.ids[0])!, state), count: g.ids.length },
      selectable: false,
      draggable: false,
      focusable: false,
    }));
    const decisionNodes: Node<DecisionData>[] = layout.placed.map(({ decision, x, y }) => {
      const owner = ownerOf(decision, state);
      const goal = goalOf(decision);
      const accent =
        colorBy === 'owner'
          ? personColor(owner?.id, state.teammates)
          : colorBy === 'goal'
            ? palette.colorOf(goal)
            : undefined;
      return {
        id: decision.id,
        type: 'decision',
        position: { x, y },
        selected: decision.id === selectedId,
        draggable: tree,
        // The card's own button takes focus, so the node wrapper doesn't add a second tab stop.
        focusable: false,
        data: {
          decision,
          status: mapStatus(decision, state, today),
          chosen: chosenLabel(decision, state),
          initials: owner?.initials ?? '?',
          ownerName: owner?.name ?? 'Unknown',
          ownerColor: personColor(owner?.id, state.teammates),
          faded: !!neighbors && !neighbors.has(decision.id),
          dimmed: !!matchIds && !matchIds.has(decision.id),
          matched: !!matchIds && matchIds.has(decision.id),
          highlighted: highlightIds.includes(decision.id),
          traced: !!traced && traced.has(decision.id),
          accent,
          goal: colorBy === 'goal' ? goal : undefined,
          simple: !detailed,
          onOpen: onSelect,
        },
      };
    });
    return [...laneNodes, ...monthNodes, ...groupNodes, ...decisionNodes];
  }, [layout, branches, decisions, state, today, selectedId, matchIds, highlightIds, onSelect, neighbors, traced, colorBy, palette, tree, detailed]);

  const edges = useMemo<Edge[]>(() => {
    const at = new Map(layout.placed.map((p) => [p.decision.id, p]));
    return links.map((l) => {
      const ai = l.origin === 'ai';
      const lit = selectedId
        ? (l.status === 'accepted' && !!traced?.has(l.fromId) && !!traced?.has(l.toId)) || l.fromId === selectedId || l.toId === selectedId
        : !!hoverId && (l.fromId === hoverId || l.toId === hoverId);
      const color = ai ? 'var(--ai-line)' : lit ? 'var(--ink)' : 'var(--ink2)';
      const from = at.get(l.fromId);
      const to = at.get(l.toId);
      // Tree: a branch leaves its parent's right side and enters the child's left, in right angles.
      // Timeline: a follow-up that starts before its parent's card ends would make a curve loop back
      // over the cards, so it leaves from the parent's bottom (or top) as a right-angle elbow instead.
      const forward = !!from && !!to && to.x >= from.x + NODE_W;
      const overlaps = !tree && !!from && !!to && to.x < from.x + NODE_W + 40;
      const [sourceHandle, targetHandle] = tree
        ? forward
          ? ['right', 'left']
          : graphHandles(from, to)
        : [overlaps ? (to!.y >= from!.y ? 'bottom' : 'top') : 'right', 'left'];
      return {
        id: l.id,
        source: l.fromId,
        target: l.toId,
        sourceHandle,
        targetHandle,
        type: (tree && forward) || overlaps ? 'smoothstep' : 'default',
        pathOptions: tree && forward ? { borderRadius: 14, offset: 24 } : undefined,
        selectable: false,
        focusable: false,
        zIndex: lit ? 1 : 0,
        className: ai ? `map-edge-ai map-edge-${l.status}` : 'map-edge-user',
        style: {
          stroke: color,
          strokeWidth: lit ? 2.4 : 1.5,
          strokeDasharray: ai ? '6 5' : undefined,
          opacity: lit ? 1 : selectedId ? 0.12 : hoverId ? 0.3 : tree ? 0.7 : 0.4,
        },
        markerEnd: { type: MarkerType.ArrowClosed, color, width: 16, height: 16 },
        // The "suggested" label only shows on the picked decision's lines, so it doesn't clutter the map.
        label: ai && l.status === 'suggested' && lit ? '✦ suggested' : undefined,
        labelClassName: 'map-edge-label',
      };
    });
  }, [links, hoverId, selectedId, layout, tree, traced]);

  const laneLabels = layout.lanes.map((lane) => {
    const mate = laneBy === 'owner' ? state.teammates.find((t) => t.name === lane.key) : undefined;
    return {
      key: lane.key,
      y: lane.y,
      count: layout.placed.filter((p) => p.lane === lane.key).length,
      color: mate ? personColor(mate.id, state.teammates) : undefined,
    };
  });

  // Bring a focused decision (from a citation, the inbox or a search) into view.
  useEffect(() => {
    const placed = layout.placed.find((p) => p.decision.id === selectedId);
    if (!placed) return;
    // The details panel covers the right edge, so center the node in what's left.
    const panelOffset = (canvas.current?.clientWidth ?? 0) > 880 ? 200 : 0;
    const still = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    void flow.setCenter(placed.x + NODE_W / 2 + panelOffset, placed.y + NODE_H / 2, {
      zoom: 1,
      duration: still ? 0 : 300,
    });
  }, [selectedId, layout, flow]);

  function openView() {
    if (selectedId) return; // the effect above centers the focused decision
    const w = canvas.current?.clientWidth ?? 0;
    const h = canvas.current?.clientHeight ?? 0;
    if (tree) {
      // The whole forest when it's readable; otherwise the biggest tree from its
      // root, at a zoom where every card can still be read.
      const top = -GROUP_LABEL_H;
      const fit = Math.min((w - 96) / layout.width, (h - 180) / (layout.height - top));
      if (fit >= TREE_FIT_ZOOM) {
        void flow.fitView({ padding: 0.12, maxZoom: 1 });
        return;
      }
      const zoom = Math.max(TREE_OPEN_ZOOM, Math.min(1, fit));
      void flow.setViewport({ x: 48, y: 76 - top * zoom, zoom });
      return;
    }
    const fit = Math.min(w / (layout.width + 80), h / (layout.height + 120));
    if (fit >= READABLE_ZOOM) {
      void flow.fitView({ padding: 0.08, maxZoom: 1 });
      return;
    }
    // Right-align the newest decisions, top lane at the top.
    void flow.setViewport({ x: w - 48 - layout.width * OPENING_ZOOM, y: 48, zoom: OPENING_ZOOM });
  }

  return (
    <div className="map-canvas" ref={canvas}>
      <ReactFlow
        key={tree ? `tree-${positionsKey}` : laneBy}
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onInit={openView}
        minZoom={0.25}
        maxZoom={1.5}
        nodesDraggable={tree}
        nodesConnectable={false}
        proOptions={{ hideAttribution: true }}
        onNodesChange={onNodesChange}
        onNodeDragStop={onNodeDragStop}
        translateExtent={
          tree
            ? undefined
            : [
                [-LANE_LABEL_W, -200],
                [layout.width + 600, layout.height + 400],
              ]
        }
        onPaneClick={() => onSelect(undefined)}
        onNodeMouseEnter={(_, node) => node.type === 'decision' && setHoverId(node.id)}
        onNodeMouseLeave={() => setHoverId(undefined)}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1.3} color="var(--grid-dot)" />
        {/* Bottom-left, clear of the agent launcher in the bottom-right corner. */}
        <Controls showInteractive={false} position="bottom-left">
          {moved && (
            <ControlButton onClick={tidy} title="Put every card back in its tree" aria-label="Tidy the tree">
              <IconTidy />
            </ControlButton>
          )}
        </Controls>
        {!tree && laneBy !== 'none' && <LaneLabels lanes={laneLabels} />}
      </ReactFlow>
    </div>
  );
}

function IconTidy() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <rect x="1.5" y="6" width="4" height="4" rx="1" />
      <rect x="10.5" y="2" width="4" height="4" rx="1" />
      <rect x="10.5" y="10" width="4" height="4" rx="1" />
      <path d="M5.5 8h2.5M8 4v8M8 4h2.5M8 12h2.5" />
    </svg>
  );
}

// A link that doesn't run forward (Rooted's suggestions can) leaves the side of its source that faces its target.
function graphHandles(from?: { x: number; y: number }, to?: { x: number; y: number }): [string, string] {
  if (!from || !to) return ['right', 'left'];
  const dx = to.x - from.x;
  const dy = (to.y - from.y) * (NODE_W / NODE_H);
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? ['right', 'left'] : ['out-left', 'in-right'];
  return dy >= 0 ? ['out-bottom', 'in-top'] : ['out-top', 'in-bottom'];
}
