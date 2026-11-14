// F-17, F-19: the decision map. In Timeline, each node is a decision placed by
// when it was made, in a swimlane. In Graph (the default, decision 0010), a
// force layout arranges decisions by their links, and nodes can be dragged;
// where you put them is remembered per scope. Solid lines are links the team made ("builds on");
// dashed sage lines are connections Rooted found, until someone accepts or
// dismisses them. Wine marks only the chosen option on each node. Lines stay
// faint until you hover or pick a decision; then its connections light up.
import {
  Background,
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
  MAP_STATUS_LABEL,
  mapStatus,
  ownerOf,
  visibleLinks,
  type MapStatus,
} from '../../store/dashboard';
import type { AppState, Decision } from '../../types';
import { graphLayout, lineage, type GraphEdge, type Pt } from './graphLayout';
import { loadPositions, savePositions, type Positions } from './positions';
import { LANE_LABEL_W, layoutMap, NODE_H, NODE_W, type LaneBy } from './mapLayout';

export type MapLayoutMode = 'graph' | 'timeline';
export type ColorBy = 'status' | 'goal' | 'owner';

/** What "goal" colours by: the decision's goal label, else its first tag. */
export function goalOf(d: Decision): string | undefined {
  return d.metric ?? d.tags?.[0]?.label;
}

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
  traced: boolean; // on the picked decision's lineage while Trace is on
  accent?: string; // stripe color when coloring by goal or owner
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
        aria-label={`${d.question}, ${d.speculative ? 'direction to explore' : MAP_STATUS_LABEL[data.status]}${data.traced ? ', on the traced path' : ''}`}
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
            <span className="muted map-node-chosen-plain" aria-hidden="true">
              {d.speculative ? '' : 'Not decided yet'}
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
              <span className="muted map-node-undecided">Not decided yet</span>
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

function MonthNode({ data }: NodeProps<Node<{ label: string }>>) {
  return <span className="map-month">{data.label}</span>;
}

const nodeTypes = { decision: DecisionNode, lane: LaneNode, month: MonthNode };

export interface DecisionMapProps {
  state: AppState;
  decisions: Decision[]; // already filtered
  mode: MapLayoutMode;
  laneBy: LaneBy;
  colorBy: ColorBy;
  detailed: boolean; // full node cards (power users); off = the quiet default
  trace: boolean;
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
  trace,
  positionsKey,
  today,
  selectedId,
  matchIds,
  highlightIds,
  onSelect,
}: DecisionMapProps) {
  const flow = useReactFlow();
  const canvas = useRef<HTMLDivElement>(null);
  const graph = mode === 'graph';
  const timeline = useMemo(() => layoutMap(decisions, laneBy, state, today), [decisions, laneBy, state, today]);
  const [hoverId, setHoverId] = useState<string | undefined>(undefined);

  // The decision whose connections stand out: the one under the pointer, else the one picked.
  const focusId = hoverId ?? selectedId;
  const links = useMemo(() => {
    const shown = new Set(decisions.map((d) => d.id));
    return visibleLinks(state).filter((l) => shown.has(l.fromId) && shown.has(l.toId));
  }, [decisions, state]);
  // Lineage follows links the team made or accepted, not ones Rooted only suggested.
  const confirmed = useMemo<GraphEdge[]>(
    () => links.filter((l) => l.status === 'accepted').map((l) => ({ from: l.fromId, to: l.toId })),
    [links],
  );
  const traced = useMemo(
    () => (trace && selectedId ? lineage(confirmed, selectedId) : null),
    [trace, selectedId, confirmed],
  );

  // Graph: the force layout, with any node the PM dragged where they left it.
  const [custom, setCustom] = useState<Positions>(() => loadPositions(positionsKey));
  useEffect(() => setCustom(loadPositions(positionsKey)), [positionsKey]);
  const forced = useMemo(
    () => (graph ? graphLayout(decisions.map((d) => d.id), confirmed) : new Map<string, Pt>()),
    [graph, decisions, confirmed],
  );
  const layout = useMemo(() => {
    if (!graph) return timeline;
    const placed = timeline.placed.map((p) => {
      const c = forced.get(p.decision.id) ?? { x: 0, y: 0 };
      const at = custom[p.decision.id] ?? { x: c.x - NODE_W / 2, y: c.y - NODE_H / 2 };
      return { ...p, x: at.x, y: at.y };
    });
    return { ...timeline, placed, lanes: [], months: [] };
  }, [graph, timeline, forced, custom]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      if (!graph) return;
      const moved = changes.filter((c) => c.type === 'position' && c.position);
      if (moved.length === 0) return;
      setCustom((prev) => {
        const next = { ...prev };
        for (const c of moved) if (c.type === 'position' && c.position) next[c.id] = c.position;
        return next;
      });
    },
    [graph],
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

  const palette = useMemo(() => goalPalette(decisions), [decisions]);

  const neighbors = useMemo(() => {
    if (traced) return traced;
    if (!selectedId) return null;
    const ids = new Set([selectedId]);
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
        draggable: graph,
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
    return [...laneNodes, ...monthNodes, ...decisionNodes];
  }, [layout, state, today, selectedId, matchIds, highlightIds, onSelect, neighbors, traced, colorBy, palette, graph, detailed]);

  const edges = useMemo<Edge[]>(() => {
    const at = new Map(layout.placed.map((p) => [p.decision.id, p]));
    return links.map((l) => {
        const ai = l.origin === 'ai';
        const lit = traced
          ? traced.has(l.fromId) && traced.has(l.toId) && l.status === 'accepted'
          : !!focusId && (l.fromId === focusId || l.toId === focusId);
        const color = ai ? 'var(--ai-line)' : lit ? 'var(--ink)' : 'var(--ink2)';
        // A follow-up that starts before its parent's card ends would make a curve loop back over
        // the cards, so it leaves from the parent's bottom (or top) as a right-angle elbow instead.
        const from = at.get(l.fromId);
        const to = at.get(l.toId);
        const overlaps = !graph && !!from && !!to && to.x < from.x + NODE_W + 40;
        const [sourceHandle, targetHandle] = graph
          ? graphHandles(from, to)
          : [overlaps ? (to!.y >= from!.y ? 'bottom' : 'top') : 'right', 'left'];
        return {
          id: l.id,
          source: l.fromId,
          target: l.toId,
          sourceHandle,
          targetHandle,
          type: overlaps ? 'smoothstep' : 'default',
          selectable: false,
          focusable: false,
          zIndex: lit ? 1 : 0,
          className: ai ? `map-edge-ai map-edge-${l.status}` : 'map-edge-user',
          style: {
            stroke: color,
            strokeWidth: lit ? 2.4 : 1.4,
            strokeDasharray: ai ? '6 5' : undefined,
            opacity: lit ? 1 : focusId || traced ? 0.12 : 0.4,
          },
          markerEnd: { type: MarkerType.ArrowClosed, color, width: 16, height: 16 },
          // The "suggested" label only shows on the picked decision's lines, so it doesn't clutter the map.
          label: ai && l.status === 'suggested' && lit ? '✦ suggested' : undefined,
          labelClassName: 'map-edge-label',
        };
      });
  }, [links, focusId, layout, graph, traced]);

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
    if (graph) {
      // Open close-up on the most recent decision, not zoomed out to fit everything,
      // so the map reads as a workspace you're already in rather than a distant map.
      const newest = [...layout.placed].sort((a, b) =>
        decisionDate(b.decision).localeCompare(decisionDate(a.decision)),
      )[0];
      if (newest) {
        // No animation on first paint; this is the opening position, not a move.
        void flow.setCenter(newest.x + NODE_W / 2, newest.y + NODE_H / 2, { zoom: 0.9, duration: 0 });
      } else {
        void flow.fitView({ padding: 0.2, maxZoom: 1 });
      }
      return;
    }
    const w = canvas.current?.clientWidth ?? 0;
    const h = canvas.current?.clientHeight ?? 0;
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
        key={graph ? `graph-${positionsKey}` : laneBy}
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onInit={openView}
        minZoom={0.25}
        maxZoom={1.5}
        nodesDraggable={graph}
        nodesConnectable={false}
        proOptions={{ hideAttribution: true }}
        onNodesChange={onNodesChange}
        onNodeDragStop={onNodeDragStop}
        translateExtent={
          graph
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
        <Controls showInteractive={false} position="bottom-left" />
        {!graph && laneBy !== 'none' && <LaneLabels lanes={laneLabels} />}
      </ReactFlow>
    </div>
  );
}

// In Graph, a link leaves the side of its source that faces its target.
function graphHandles(from?: { x: number; y: number }, to?: { x: number; y: number }): [string, string] {
  if (!from || !to) return ['right', 'left'];
  const dx = to.x - from.x;
  const dy = (to.y - from.y) * (NODE_W / NODE_H);
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? ['right', 'left'] : ['out-left', 'in-right'];
  return dy >= 0 ? ['out-bottom', 'in-top'] : ['out-top', 'in-bottom'];
}
