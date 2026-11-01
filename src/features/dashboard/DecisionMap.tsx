// F-17, F-19: the decision map. Each node is a decision placed by when it was
// made, in a swimlane. Solid lines are links the team made ("builds on");
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
  type Edge,
  type Node,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
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
import { LANE_LABEL_W, layoutMap, NODE_H, NODE_W, type LaneBy } from './mapLayout';

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
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <div className={cls} style={{ width: NODE_W, height: NODE_H }}>
      <Handle type="target" id="left" position={Position.Left} isConnectable={false} className="map-handle" />
      {/* Elbows leave near the left edge, so a follow-up hangs off its parent like an indented outline. */}
      <Handle type="source" id="top" position={Position.Top} isConnectable={false} className="map-handle map-handle-elbow" />
      <button
        type="button"
        className="map-node-hit"
        aria-label={`${d.question}, ${MAP_STATUS_LABEL[data.status]}`}
        aria-pressed={!!selected}
        onClick={() => data.onOpen(d.id)}
      />
      <p className="map-node-meta" aria-hidden="true">
        <span className={`map-dot map-dot-${data.status}`} aria-hidden="true" />
        <span className={data.status === 'outcome-due' ? 'due-label' : undefined}>{MAP_STATUS_LABEL[data.status]}</span>
        <span aria-hidden="true">·</span>
        <span className="tabular">{formatDate(decisionDate(d))}</span>
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
  laneBy: LaneBy;
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

function MapInner({ state, decisions, laneBy, today, selectedId, matchIds, highlightIds, onSelect }: DecisionMapProps) {
  const flow = useReactFlow();
  const canvas = useRef<HTMLDivElement>(null);
  const layout = useMemo(() => layoutMap(decisions, laneBy, state, today), [decisions, laneBy, state, today]);
  const [hoverId, setHoverId] = useState<string | undefined>(undefined);

  // The decision whose connections stand out: the one under the pointer, else the one picked.
  const focusId = hoverId ?? selectedId;
  const links = useMemo(() => {
    const shown = new Set(decisions.map((d) => d.id));
    return visibleLinks(state).filter((l) => shown.has(l.fromId) && shown.has(l.toId));
  }, [decisions, state]);
  const neighbors = useMemo(() => {
    if (!selectedId) return null;
    const ids = new Set([selectedId]);
    for (const l of links) {
      if (l.fromId === selectedId) ids.add(l.toId);
      if (l.toId === selectedId) ids.add(l.fromId);
    }
    return ids;
  }, [links, selectedId]);

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
      return {
        id: decision.id,
        type: 'decision',
        position: { x, y },
        selected: decision.id === selectedId,
        draggable: false,
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
          onOpen: onSelect,
        },
      };
    });
    return [...laneNodes, ...monthNodes, ...decisionNodes];
  }, [layout, state, today, selectedId, matchIds, highlightIds, onSelect, neighbors]);

  const edges = useMemo<Edge[]>(() => {
    const at = new Map(layout.placed.map((p) => [p.decision.id, p]));
    return links.map((l) => {
        const ai = l.origin === 'ai';
        const lit = !!focusId && (l.fromId === focusId || l.toId === focusId);
        const color = ai ? 'var(--ai-line)' : lit ? 'var(--ink)' : 'var(--ink2)';
        // A follow-up that starts before its parent's card ends would make a curve loop back over
        // the cards, so it leaves from the parent's bottom (or top) as a right-angle elbow instead.
        const from = at.get(l.fromId);
        const to = at.get(l.toId);
        const overlaps = !!from && !!to && to.x < from.x + NODE_W + 40;
        const sourceHandle = overlaps ? (to!.y >= from!.y ? 'bottom' : 'top') : 'right';
        return {
          id: l.id,
          source: l.fromId,
          target: l.toId,
          sourceHandle,
          targetHandle: 'left',
          type: overlaps ? 'smoothstep' : 'default',
          selectable: false,
          focusable: false,
          zIndex: lit ? 1 : 0,
          className: ai ? `map-edge-ai map-edge-${l.status}` : 'map-edge-user',
          style: {
            stroke: color,
            strokeWidth: lit ? 2.4 : 1.4,
            strokeDasharray: ai ? '6 5' : undefined,
            opacity: lit ? 1 : focusId ? 0.12 : 0.4,
          },
          markerEnd: { type: MarkerType.ArrowClosed, color, width: 16, height: 16 },
          // The "suggested" label only shows on the picked decision's lines, so it doesn't clutter the map.
          label: ai && l.status === 'suggested' && lit ? '✦ suggested' : undefined,
          labelClassName: 'map-edge-label',
        };
      });
  }, [links, focusId, layout]);

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
        key={laneBy}
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onInit={openView}
        minZoom={0.25}
        maxZoom={1.5}
        nodesDraggable={false}
        nodesConnectable={false}
        translateExtent={[
          [-LANE_LABEL_W, -200],
          [layout.width + 600, layout.height + 400],
        ]}
        onPaneClick={() => onSelect(undefined)}
        onNodeMouseEnter={(_, node) => node.type === 'decision' && setHoverId(node.id)}
        onNodeMouseLeave={() => setHoverId(undefined)}
      >
        <Background gap={32} size={1} color="var(--card-rule)" />
        <Controls showInteractive={false} position="bottom-left" />
        {laneBy !== 'none' && <LaneLabels lanes={laneLabels} />}
      </ReactFlow>
    </div>
  );
}
