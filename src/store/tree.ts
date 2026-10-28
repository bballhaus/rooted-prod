// Helpers for the option tree (F-10). Options are stored flat; parentId links a
// sub-option to its branch. Shared by the store, the fake agent and the UI.
import type { OptionNode } from '../types';

export function childrenOf(options: OptionNode[], parentId: string | null): OptionNode[] {
  return options.filter((o) => o.parentId === parentId);
}

/** Ids from the top-level branch down to the option's parent. */
export function ancestorIds(options: OptionNode[], id: string): string[] {
  const byId = new Map(options.map((o) => [o.id, o]));
  const path: string[] = [];
  let parent = byId.get(id)?.parentId ?? null;
  while (parent && byId.has(parent) && !path.includes(parent)) {
    path.unshift(parent);
    parent = byId.get(parent)!.parentId;
  }
  return path;
}

export function descendantIds(options: OptionNode[], id: string): Set<string> {
  const out = new Set<string>();
  const stack = [id];
  while (stack.length) {
    const next = stack.pop()!;
    for (const c of options) {
      if (c.parentId === next && !out.has(c.id)) {
        out.add(c.id);
        stack.push(c.id);
      }
    }
  }
  return out;
}

export function depthOf(options: OptionNode[], id: string): number {
  return ancestorIds(options, id).length;
}

/** "Extend the trial › 21 days › Team plan only" */
export function pathLabel(options: OptionNode[], id: string): string {
  const byId = new Map(options.map((o) => [o.id, o]));
  return [...ancestorIds(options, id), id].map((x) => byId.get(x)?.label ?? '').join(' › ');
}

/** True when a branch above this option was pruned. */
export function underPruned(options: OptionNode[], id: string): boolean {
  const byId = new Map(options.map((o) => [o.id, o]));
  return ancestorIds(options, id).some((a) => byId.get(a)?.state === 'pruned');
}

/**
 * Logging a choice keeps the branches above it and the sub-options below it.
 * Every other option is not taken. The alternatives are the ones that branch
 * off the chosen path; each needs its own reason, and options under an
 * alternative are pruned with it.
 */
export function splitForLog(options: OptionNode[], chosenId: string) {
  const keep = new Set([chosenId, ...ancestorIds(options, chosenId), ...descendantIds(options, chosenId)]);
  const path = new Set(ancestorIds(options, chosenId));
  const notTaken = options.filter((o) => !keep.has(o.id));
  const alternatives = notTaken.filter((o) => o.parentId === null || path.has(o.parentId));
  return { keep, notTaken, alternatives };
}
