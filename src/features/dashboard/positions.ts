// Where the PM dragged cards in the map's Tree view (0010, 0019), saved per scope.
// v2: positions dragged in the old force-laid Graph don't carry over to the tree.
import type { Pt } from './graphLayout';

// Where nodes were dragged to, per scope, in their own key (never the app store).
export const POS_KEY = 'rooted-map-pos-v2';
export type Positions = Record<string, Pt>;

export function loadPositions(key: string): Positions {
  try {
    return (JSON.parse(localStorage.getItem(POS_KEY) || '{}') as Record<string, Positions>)[key] ?? {};
  } catch {
    return {};
  }
}

export function savePositions(key: string, positions: Positions) {
  try {
    const all = JSON.parse(localStorage.getItem(POS_KEY) || '{}') as Record<string, Positions>;
    all[key] = positions;
    localStorage.setItem(POS_KEY, JSON.stringify(all));
  } catch {
    // positions just won't be remembered
  }
}
