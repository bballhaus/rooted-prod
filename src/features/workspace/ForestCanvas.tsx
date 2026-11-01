// The causal map: many decisions laid out left to right by how they build on
// each other. Roots sit on the left, the calls they led to spread rightward, and
// the speculative "next" directions trail off the end. Each node is a real button
// over an SVG of connectors, so the whole map is keyboard reachable. Colour and
// dot shape carry meaning: wine = a decision made, sage = one in progress, berry
// (dashed) = a direction still being explored.
import { useMemo, useRef, useEffect } from 'react';
import type { Decision, OptionNode } from '../../types';

const NODE_W = 202;
const NODE_H = 118;
const GAP_X = 66;
const ROW_H = 134;
const PAD = 18;
const BAND_H = 34;

interface Placed {
  id: string;
  decision: Decision;
  x: number;
  y: number;
  col: number;
}

type Kind = 'decided' | 'open' | 'future';

function kindOf(d: Decision): Kind {
  if (d.speculative || d.horizon === 'future') return 'future';
  if (d.status === 'decided') return 'decided';
  return 'open';
}

const STEP_WORD: Record<Decision['status'], string> = {
  framing: 'Framing the question',
  brief: 'Gathering evidence',
  options: 'Weighing options',
  decided: 'Decided',
};

export function ForestCanvas({
  decisions,
  options,
  selectedId,
  onSelect,
}: {
  decisions: Decision[];
  options: OptionNode[];
  selectedId?: string;
  onSelect: (id: string) => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);

  const { placed, edges, width, height, bands } = useMemo(() => {
    const byId = new Map(decisions.map((d) => [d.id, d]));
    const present = (id: string) => byId.has(id);

    // Longest-path depth from a root, so a decision always sits to the right of
    // every decision it builds on. Memoised with a cycle guard.
    const depth = new Map<string, number>();
    const computing = new Set<string>();
    function depthOf(id: string): number {
      if (depth.has(id)) return depth.get(id)!;
      if (computing.has(id)) return 0;
      computing.add(id);
      const parents = (byId.get(id)?.builtOn ?? []).filter(present);
      const d = parents.length ? Math.max(...parents.map(depthOf)) + 1 : 0;
      computing.delete(id);
      depth.set(id, d);
      return d;
    }
    decisions.forEach((d) => depthOf(d.id));

    // Group into columns and order each column oldest-first for a stable layout.
    const maxCol = Math.max(0, ...decisions.map((d) => depth.get(d.id)!));
    const cols: Decision[][] = Array.from({ length: maxCol + 1 }, () => []);
    decisions.forEach((d) => cols[depth.get(d.id)!].push(d));
    cols.forEach((c) => c.sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
    const maxRows = Math.max(1, ...cols.map((c) => c.length));

    const placed: Placed[] = [];
    cols.forEach((col, ci) => {
      const top = ((maxRows - col.length) * ROW_H) / 2;
      col.forEach((d, ri) => {
        placed.push({
          id: d.id,
          decision: d,
          col: ci,
          x: PAD + ci * (NODE_W + GAP_X),
          y: PAD + BAND_H + top + ri * ROW_H,
        });
      });
    });

    const pos = new Map(placed.map((p) => [p.id, p]));
    const edges: { from: Placed; to: Placed; future: boolean }[] = [];
    for (const p of placed) {
      for (const parentId of p.decision.builtOn ?? []) {
        const from = pos.get(parentId);
        if (from) edges.push({ from, to: p, future: kindOf(p.decision) === 'future' });
      }
    }

    // Horizon bands across the top, spanning the columns their nodes occupy.
    const bandDefs: { key: 'past' | 'now' | 'future'; label: string }[] = [
      { key: 'past', label: 'Past decisions' },
      { key: 'now', label: 'In progress' },
      { key: 'future', label: 'Directions to explore' },
    ];
    const horizonOf = (d: Decision) => d.horizon ?? (d.status === 'decided' ? 'past' : 'now');
    const bands = bandDefs
      .map((b) => {
        const xs = placed.filter((p) => horizonOf(p.decision) === b.key);
        if (!xs.length) return null;
        const left = Math.min(...xs.map((p) => p.x));
        const right = Math.max(...xs.map((p) => p.x + NODE_W));
        return { ...b, left, right };
      })
      .filter((b): b is NonNullable<typeof b> => !!b);

    const width = PAD * 2 + (maxCol + 1) * NODE_W + maxCol * GAP_X;
    const height = PAD * 2 + BAND_H + maxRows * ROW_H;
    return { placed, edges, width, height, bands };
  }, [decisions]);

  // Keep the selected node in view when it changes.
  const target = placed.find((p) => p.id === selectedId);
  useEffect(() => {
    const el = scroller.current;
    if (!el || !target) return;
    if (target.x < el.scrollLeft || target.x + NODE_W > el.scrollLeft + el.clientWidth) {
      el.scrollLeft = Math.max(0, target.x - 48);
    }
  }, [target?.id, target?.x]);

  if (!placed.length) return null;

  return (
    <div className="forest-scroll" ref={scroller}>
      <div className="forest" style={{ width, height }}>
        <svg className="forest-lines" width={width} height={height} aria-hidden="true">
          {bands.map((b) => (
            <g key={b.key}>
              <line
                className={`forest-band forest-band-${b.key}`}
                x1={b.left}
                y1={PAD + BAND_H - 10}
                x2={b.right}
                y2={PAD + BAND_H - 10}
              />
            </g>
          ))}
          {edges.map((e, i) => {
            const x1 = e.from.x + NODE_W;
            const y1 = e.from.y + NODE_H / 2;
            const x2 = e.to.x;
            const y2 = e.to.y + NODE_H / 2;
            const mid = (x1 + x2) / 2;
            return (
              <path
                key={i}
                className={`forest-edge${e.future ? ' forest-edge-future' : ''}`}
                d={`M${x1},${y1} C${mid},${y1} ${mid},${y2} ${x2},${y2}`}
              />
            );
          })}
        </svg>

        {bands.map((b) => (
          <span key={b.key} className="forest-band-label" style={{ left: b.left, top: PAD }}>
            {b.label}
          </span>
        ))}

        {placed.map((p) => {
          const d = p.decision;
          const kind = kindOf(d);
          const chosen = options.find((o) => o.id === d.chosenOptionId)?.label;
          const selected = selectedId === d.id;
          const dotClass = kind === 'decided' ? 'dot-chosen' : kind === 'future' ? 'dot-pruned' : 'dot-alive';
          const foot =
            kind === 'decided'
              ? chosen
                ? `Chose: ${chosen}`
                : 'Decided'
              : kind === 'future'
                ? 'Direction to explore'
                : STEP_WORD[d.status];
          const aria = `${d.question}. ${foot}.${d.metric ? ` ${d.metric}.` : ''}`;
          return (
            <button
              key={d.id}
              type="button"
              className={`forest-node forest-node-${kind}${selected ? ' forest-node-selected' : ''}`}
              style={{ left: p.x, top: p.y, width: NODE_W, height: NODE_H }}
              aria-pressed={selected}
              aria-label={aria}
              onClick={() => onSelect(d.id)}
            >
              <span className="forest-node-top">
                <span className={`dot ${dotClass}`} aria-hidden="true" />
                {d.metric && <span className="forest-node-metric">{d.metric}</span>}
              </span>
              <span className="forest-node-q">{d.question}</span>
              <span className={`forest-node-foot forest-node-foot-${kind}`}>{foot}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
