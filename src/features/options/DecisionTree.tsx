// F-10, F-11: the options as a tree graph. Read left to right: past decisions
// this one builds on, the decision itself, then its branches and sub-branches.
// Nodes are real buttons laid out over an SVG of connectors, so the graph is
// keyboard reachable and every node is a 44px+ target. Only the PM's chosen
// branch is wine.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { childrenOf, pathLabel, underPruned } from '../../store/tree';
import type { Criteria, CriterionKey, OptionNode } from '../../types';

export interface LinkedDecision {
  id: string;
  question: string;
  outcome?: string; // the option that was chosen, if logged
}

export const CRITERIA: { key: CriterionKey; label: string; short: string; hint: string }[] = [
  { key: 'impact', label: 'Impact on the goal', short: 'Impact', hint: 'Higher is better' },
  { key: 'effort', label: 'Effort', short: 'Effort', hint: 'Lower is easier' },
  { key: 'risk', label: 'Risk', short: 'Risk', hint: 'Lower is safer' },
  { key: 'evidence', label: 'Evidence behind it', short: 'Evidence', hint: 'More is better' },
];

export function criteriaText(c: Criteria | undefined): string {
  if (!c) return 'Not rated';
  return CRITERIA.filter((k) => c[k.key])
    .map((k) => `${k.short} ${c[k.key]} of 5`)
    .join(', ');
}

const NODE_W = 216;
const NODE_H = 108;
const GAP_X = 72; // room for the connector and the collapse button
const ROW_H = NODE_H + 20;
const ROOT = '__root__';

interface Placed {
  id: string;
  option?: OptionNode;
  x: number;
  y: number;
  depth: number;
}

export function DecisionTree({
  question,
  options,
  linked,
  chosenId,
  focusId,
  onFocus,
}: {
  question: string;
  options: OptionNode[];
  linked: LinkedDecision[];
  chosenId?: string;
  focusId?: string;
  onFocus: (option: OptionNode | null) => void;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const scroller = useRef<HTMLDivElement>(null);
  const shift = linked.length ? 1 : 0;

  const { placed, edges, width, height } = useMemo(() => {
    const placed: Placed[] = [];
    const edges: { from: Placed; to: Placed }[] = [];
    let row = 0;
    // Classic tidy layout: leaves take the next row, a parent sits midway
    // between its first and last child.
    function place(id: string, option: OptionNode | undefined, depth: number): Placed {
      const kids = id === ROOT || !collapsed.has(id) ? childrenOf(options, id === ROOT ? null : id) : [];
      const x = (depth + shift) * (NODE_W + GAP_X);
      let node: Placed;
      if (kids.length === 0) {
        node = { id, option, x, y: row++ * ROW_H, depth };
      } else {
        const placedKids = kids.map((k) => place(k.id, k, depth + 1));
        const y = (placedKids[0].y + placedKids[placedKids.length - 1].y) / 2;
        node = { id, option, x, y, depth };
        placedKids.forEach((k) => edges.push({ from: node, to: k }));
      }
      placed.push(node);
      return node;
    }
    const root = place(ROOT, undefined, 0);
    const rows = Math.max(row, linked.length);
    // Past decisions stack in their own column, centred on the decision.
    const pastTop = Math.max(0, root.y - ((linked.length - 1) * ROW_H) / 2);
    linked.forEach((_, i) => {
      const past: Placed = { id: `past-${i}`, x: 0, y: pastTop + i * ROW_H, depth: -1 };
      edges.push({ from: past, to: root });
    });
    const maxDepth = Math.max(...placed.map((p) => p.depth));
    return {
      placed,
      edges,
      width: (maxDepth + 1 + shift) * (NODE_W + GAP_X) - GAP_X + 48,
      height: Math.max(rows * ROW_H, pastTop + linked.length * ROW_H) - 20,
    };
  }, [options, collapsed, linked, shift]);

  const root = placed.find((p) => p.id === ROOT)!;
  const pastTop = linked.length ? edges.find((e) => e.from.id === 'past-0')!.from.y : 0;

  // Deep trees are wider than the page: keep the chosen (or picked) node in view.
  const target = placed.find((p) => p.id === (focusId ?? chosenId));
  useEffect(() => {
    const el = scroller.current;
    if (!el || !target) return;
    if (target.x < el.scrollLeft || target.x + NODE_W > el.scrollLeft + el.clientWidth) {
      el.scrollLeft = Math.max(0, target.x - 48);
    }
  }, [target?.id, target?.x]);

  function toggle(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function edgeClass(to: Placed): string {
    const o = to.option;
    // Only the edges into the decision itself have no option: they come from past decisions.
    if (!o) return 'options-edge options-edge-link';
    if (o.state === 'pruned' || underPruned(options, o.id)) return 'options-edge options-edge-pruned';
    return 'options-edge';
  }

  return (
    <div className="options-tree-scroll" ref={scroller}>
      <div className="options-tree" style={{ width, height }}>
        <svg className="options-tree-lines" width={width} height={height} aria-hidden="true">
          {edges.map((e, i) => {
            const x1 = e.from.x + NODE_W;
            const y1 = e.from.y + NODE_H / 2;
            const x2 = e.to.x;
            const y2 = e.to.y + NODE_H / 2;
            const mid = (x1 + x2) / 2;
            return (
              <path key={i} className={edgeClass(e.to)} d={`M${x1},${y1} C${mid},${y1} ${mid},${y2} ${x2},${y2}`} />
            );
          })}
        </svg>

        {linked.map((d, i) => (
          <Link
            key={d.id}
            to={`/decisions/${d.id}`}
            className="options-node options-node-past"
            style={{ left: 0, top: pastTop + i * ROW_H, width: NODE_W, height: NODE_H }}
          >
            <span className="options-node-kicker">Builds on a past decision</span>
            <span className="options-node-label">{d.question}</span>
            {d.outcome && <span className="options-node-meta">Chose: {d.outcome}</span>}
          </Link>
        ))}

        <button
          type="button"
          className={`options-node options-node-root${focusId ? '' : ' options-node-focus'}`}
          style={{ left: root.x, top: root.y, width: NODE_W, height: NODE_H }}
          aria-current={focusId ? undefined : 'true'}
          onClick={() => onFocus(null)}
        >
          <span className="options-node-kicker">Decision</span>
          <span className="options-node-label">{question}</span>
          <span className="visually-hidden">. Show the top-level options.</span>
        </button>

        {placed
          .filter((p) => p.option)
          .map((p) => {
            const o = p.option!;
            const kids = childrenOf(options, o.id).length;
            const isChosen = chosenId === o.id;
            const pruned = o.state === 'pruned';
            const faded = !pruned && underPruned(options, o.id);
            const classes = ['options-node'];
            if (isChosen) classes.push('options-node-chosen');
            if (pruned) classes.push('options-node-pruned');
            if (faded) classes.push('options-node-faded');
            if (focusId === o.id) classes.push('options-node-focus');
            const status = isChosen ? 'Your choice' : pruned ? 'Pruned' : faded ? 'Under a pruned branch' : 'Open';
            return (
              <div key={o.id}>
                <button
                  type="button"
                  className={classes.join(' ')}
                  style={{ left: p.x, top: p.y, width: NODE_W, height: NODE_H }}
                  aria-current={focusId === o.id ? 'true' : undefined}
                  aria-label={`${pathLabel(options, o.id)}. ${status}. Rough score ${o.score}. ${criteriaText(o.criteria)}.`}
                  onClick={() => onFocus(o)}
                >
                  <span className="options-node-kicker">
                    <span
                      className={`dot ${isChosen ? 'dot-chosen' : pruned ? 'dot-pruned' : 'dot-alive'}`}
                      aria-hidden="true"
                    />
                    {status}
                  </span>
                  <span className={`options-node-label${pruned ? ' pruned-label' : ''}`}>{o.label}</span>
                  <CriteriaBars criteria={o.criteria} score={o.score} />
                </button>
                {kids > 0 && (
                  <button
                    type="button"
                    className="options-node-toggle"
                    style={{ left: p.x + NODE_W + 6, top: p.y + NODE_H / 2 - 22 }}
                    aria-expanded={!collapsed.has(o.id)}
                    onClick={() => toggle(o.id)}
                  >
                    <span aria-hidden="true">{collapsed.has(o.id) ? `+${kids}` : '−'}</span>
                    <span className="visually-hidden">
                      {collapsed.has(o.id) ? 'Expand' : 'Collapse'} the {kids} sub-options of {o.label}
                    </span>
                  </button>
                )}
              </div>
            );
          })}
      </div>
    </div>
  );
}

function CriteriaBars({ criteria, score }: { criteria?: Criteria; score: number }) {
  if (!criteria) return <span className="options-node-meta">{score ? `Rough score ${score}` : 'Not rated'}</span>;
  return (
    <span className="options-node-bars" aria-hidden="true">
      {CRITERIA.map((k) => (
        <span key={k.key} className="options-node-bar" title={`${k.label}: ${criteria[k.key] ?? '–'} of 5`}>
          <span className="options-node-bar-name">{k.short.slice(0, 3)}</span>
          <span className="options-node-bar-track">
            <span className="options-node-bar-fill" style={{ width: `${((criteria[k.key] ?? 0) / 5) * 100}%` }} />
          </span>
        </span>
      ))}
      <span className="tabular options-node-score">{score}</span>
    </span>
  );
}
