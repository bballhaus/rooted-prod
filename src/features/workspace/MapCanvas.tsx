// The draggable, zoomable decision canvas. Nodes are real buttons positioned in
// a transformed "world"; the whole thing pans (drag the background), zooms
// (wheel) and lets you drag nodes to arrange them. Custom positions persist per
// view and scope. Keyboard users get a real focusable button per node and the
// inspector for detail, so the canvas is not the only way in.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { IconPlus } from '../../components/icons';
import { buildEdges, graphLayout, timelineLayout, type MapNode, type Pt } from './map';

const NODE_W = 184;
const NODE_H = 88;
const POS_KEY = 'rooted-map-pos-v1';

type Positions = Record<string, Pt>;

function loadAll(): Record<string, Positions> {
  try {
    return JSON.parse(localStorage.getItem(POS_KEY) || '{}');
  } catch {
    return {};
  }
}
function saveFor(key: string, positions: Positions) {
  try {
    const all = loadAll();
    all[key] = positions;
    localStorage.setItem(POS_KEY, JSON.stringify(all));
  } catch {
    // ignore
  }
}

const STEP_WORD: Record<string, string> = {
  framing: 'Framing',
  brief: 'Gathering evidence',
  options: 'Weighing options',
  decided: 'Decided',
};

export interface MapCanvasProps {
  nodes: MapNode[];
  view: 'graph' | 'timeline';
  scope: 'me' | 'org';
  colorOf: (n: MapNode) => string;
  selectedId?: string;
  traceSet: Set<string> | null;
  onSelect: (id: string | null) => void;
  onOpen: (id: string) => void;
}

export function MapCanvas({ nodes, view, scope, colorOf, selectedId, traceSet, onSelect, onOpen }: MapCanvasProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const edges = useMemo(() => buildEdges(nodes), [nodes]);
  const layoutKey = `${scope}:${view}`;

  const defaults = useMemo(
    () => (view === 'timeline' ? timelineLayout(nodes) : graphLayout(nodes, edges)),
    [nodes, edges, view],
  );

  const [positions, setPositions] = useState<Positions>({});
  const [transform, setTransform] = useState({ x: 0, y: 0, z: 1 });
  const nodeSig = useMemo(() => nodes.map((n) => n.id).sort().join(','), [nodes]);

  // Seed positions for the current view/scope: persisted override, else layout.
  useEffect(() => {
    const saved = loadAll()[layoutKey] ?? {};
    const next: Positions = {};
    for (const n of nodes) next[n.id] = saved[n.id] ?? defaults.get(n.id) ?? { x: 0, y: 0 };
    setPositions(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutKey, nodeSig, defaults]);

  const fit = useCallback(
    (pos: Positions) => {
      const el = viewportRef.current;
      const ids = Object.keys(pos);
      if (!el || ids.length === 0) return;
      const vw = el.clientWidth;
      const vh = el.clientHeight;
      if (vw === 0 || vh === 0) return;
      const xs = ids.map((i) => pos[i].x);
      const ys = ids.map((i) => pos[i].y);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      // Keep clear of the floating toolbar (top) and the zoom/legend (bottom).
      const padX = 48;
      const padTop = 84;
      const padBottom = 72;
      const availW = Math.max(1, vw - padX * 2);
      const availH = Math.max(1, vh - padTop - padBottom);
      const z = Math.max(0.35, Math.min(1.1, Math.min(availW / (maxX - minX + NODE_W), availH / (maxY - minY + NODE_H))));
      const x = padX + availW / 2 - z * ((minX + maxX) / 2);
      const y = padTop + availH / 2 - z * ((minY + maxY) / 2);
      setTransform({ x, y, z });
    },
    [],
  );

  // Fit when the view/scope or the node set changes.
  useLayoutEffect(() => {
    const saved = loadAll()[layoutKey] ?? {};
    const pos: Positions = {};
    for (const n of nodes) pos[n.id] = saved[n.id] ?? defaults.get(n.id) ?? { x: 0, y: 0 };
    fit(pos);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutKey, nodeSig, defaults, fit]);

  // ── Panning the background ───────────────────────────────────────────────
  const pan = useRef<{ x: number; y: number; ox: number; oy: number; moved: boolean } | null>(null);
  function onBgPointerDown(e: React.PointerEvent) {
    if (e.button !== 0) return;
    pan.current = { x: e.clientX, y: e.clientY, ox: transform.x, oy: transform.y, moved: false };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  }
  function onBgPointerMove(e: React.PointerEvent) {
    if (!pan.current) return;
    const dx = e.clientX - pan.current.x;
    const dy = e.clientY - pan.current.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) pan.current.moved = true;
    setTransform((t) => ({ ...t, x: pan.current!.ox + dx, y: pan.current!.oy + dy }));
  }
  function onBgPointerUp(e: React.PointerEvent) {
    const wasMoved = pan.current?.moved;
    pan.current = null;
    (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
    if (!wasMoved && e.target === e.currentTarget) onSelect(null);
  }

  // ── Zoom (wheel toward the cursor) ───────────────────────────────────────
  function onWheel(e: React.WheelEvent) {
    e.preventDefault();
    const el = viewportRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    setTransform((t) => {
      const factor = Math.exp(-e.deltaY * 0.0015);
      const z = Math.max(0.3, Math.min(2.4, t.z * factor));
      const k = z / t.z;
      return { z, x: px - (px - t.x) * k, y: py - (py - t.y) * k };
    });
  }

  // ── Dragging a node ──────────────────────────────────────────────────────
  const drag = useRef<{ id: string; x: number; y: number; ox: number; oy: number } | null>(null);
  const didDrag = useRef(false);
  function onNodePointerDown(e: React.PointerEvent, id: string) {
    if (e.button !== 0) return;
    e.stopPropagation();
    const p = positions[id];
    if (!p) return;
    drag.current = { id, x: e.clientX, y: e.clientY, ox: p.x, oy: p.y };
    didDrag.current = false;
  }
  useEffect(() => {
    function move(e: PointerEvent) {
      if (!drag.current) return;
      const dx = (e.clientX - drag.current.x) / transform.z;
      const dy = (e.clientY - drag.current.y) / transform.z;
      if (Math.abs(e.clientX - drag.current.x) + Math.abs(e.clientY - drag.current.y) > 4) didDrag.current = true;
      setPositions((prev) => ({ ...prev, [drag.current!.id]: { x: drag.current!.ox + dx, y: drag.current!.oy + dy } }));
    }
    function up() {
      if (drag.current && didDrag.current) {
        setPositions((prev) => {
          saveFor(layoutKey, prev);
          return prev;
        });
      }
      drag.current = null;
      setTimeout(() => (didDrag.current = false), 0);
    }
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, [transform.z, layoutKey]);

  function nodeClick(id: string) {
    if (didDrag.current) {
      didDrag.current = false;
      return;
    }
    onSelect(id);
  }

  function zoomBy(factor: number) {
    const el = viewportRef.current;
    const px = (el?.clientWidth ?? 0) / 2;
    const py = (el?.clientHeight ?? 0) / 2;
    setTransform((t) => {
      const z = Math.max(0.3, Math.min(2.4, t.z * factor));
      const k = z / t.z;
      return { z, x: px - (px - t.x) * k, y: py - (py - t.y) * k };
    });
  }

  return (
    <div className="map-viewport" ref={viewportRef} onWheel={onWheel}>
      <div
        className="map-pan"
        onPointerDown={onBgPointerDown}
        onPointerMove={onBgPointerMove}
        onPointerUp={onBgPointerUp}
      >
        <div
          className="map-world"
          style={{ transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.z})` }}
        >
          <svg className="map-edges" width="1" height="1" style={{ overflow: 'visible' }} aria-hidden="true">
            {edges.map((e, i) => {
              const a = positions[e.from];
              const b = positions[e.to];
              if (!a || !b) return null;
              const to = nodes.find((n) => n.id === e.to);
              const future = to?.kind === 'future';
              const trace = traceSet ? traceSet.has(e.from) && traceSet.has(e.to) : false;
              const dim = traceSet ? !trace : false;
              const d =
                view === 'timeline'
                  ? `M${a.x},${a.y} C${(a.x + b.x) / 2},${a.y} ${(a.x + b.x) / 2},${b.y} ${b.x},${b.y}`
                  : `M${a.x},${a.y} L${b.x},${b.y}`;
              const cls = ['map-edge'];
              if (future) cls.push('map-edge-future');
              if (trace) cls.push('map-edge-trace');
              if (dim) cls.push('map-edge-dim');
              return <path key={i} className={cls.join(' ')} d={d} />;
            })}
          </svg>

          {nodes.map((n) => {
            const p = positions[n.id];
            if (!p) return null;
            const selected = selectedId === n.id;
            const dim = traceSet ? !traceSet.has(n.id) : false;
            const traced = traceSet ? traceSet.has(n.id) : false;
            const cls = ['map-node', `map-node-${n.kind}`];
            if (selected) cls.push('map-node-selected');
            if (dim) cls.push('map-node-dim');
            if (traced && !selected) cls.push('map-node-traced');
            const foot = n.kind === 'decided' ? (n.chosen ? `Chose: ${n.chosen}` : 'Decided') : n.kind === 'future' ? 'Direction' : STEP_WORD[n.status];
            return (
              <button
                key={n.id}
                type="button"
                className={cls.join(' ')}
                style={{
                  left: p.x - NODE_W / 2,
                  top: p.y - NODE_H / 2,
                  width: NODE_W,
                  minHeight: NODE_H,
                  ['--accent' as string]: colorOf(n),
                }}
                aria-pressed={selected}
                aria-label={`${n.question}. ${foot}.${n.metric ? ` ${n.metric}.` : ''}`}
                onPointerDown={(e) => onNodePointerDown(e, n.id)}
                onClick={() => nodeClick(n.id)}
                onDoubleClick={() => onOpen(n.id)}
              >
                <span className="map-node-top">
                  <span className="map-node-dot" aria-hidden="true" />
                  {n.metric && <span className="map-node-metric">{n.metric}</span>}
                </span>
                <span className="map-node-q">{n.question}</span>
                <span className="map-node-foot">
                  {scope === 'org' && n.external ? n.owner : foot}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="map-zoom" role="group" aria-label="Zoom">
        <button type="button" className="map-zoom-btn" aria-label="Zoom out" onClick={() => zoomBy(1 / 1.2)}>
          <span aria-hidden="true">−</span>
        </button>
        <span className="map-zoom-val tabular">{Math.round(transform.z * 100)}%</span>
        <button type="button" className="map-zoom-btn" aria-label="Zoom in" onClick={() => zoomBy(1.2)}>
          <IconPlus size={16} />
        </button>
        <button type="button" className="map-zoom-btn map-zoom-fit" onClick={() => fit(positions)}>
          Fit
        </button>
      </div>
    </div>
  );
}
