// Where the PM dragged nodes in the map's Graph view (0010), saved per scope.
import type { Pt } from './graphLayout';

// Where nodes were dragged to, per scope, in their own key (never the app store).
export const POS_KEY = 'rooted-map-pos-v1';
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
