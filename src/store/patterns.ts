// F-R3-05 (decision 0019): the numbers behind "Patterns and trends", worked out
// from the PM's own decisions and outcomes. Plain counting, no AI: Rooted's
// patterns and predictions (src/agent/patterns.ts) read these alongside the
// decisions. Planted directions (demo data) aren't decisions anyone made, so
// they're left out. Dates are local YYYY-MM-DD strings.
import type { AppState, Decision, Outcome } from '../types';
import { decisionDate, goalOf, mapStatus } from './dashboard';

export interface MonthCount {
  key: string; // YYYY-MM
  label: string; // "Nov"
  year: number;
  count: number;
}

export interface GoalStats {
  goal: string;
  count: number;
  decided: number;
  logged: number; // outcomes recorded
  worked: number;
}

export interface DecisionStats {
  total: number;
  decided: number;
  inProgress: number;
  months: MonthCount[]; // the last six calendar months, oldest first, this month last
  // The last three full months against the three before them; this month isn't
  // over, so it's left out. Null with too few decisions to call a direction.
  trend: 'up' | 'down' | 'steady' | null;
  trendCounts: { recent: number; before: number };
  medianDaysToDecide: number | null;
  outcomes: Record<Outcome['result'], number> & { logged: number };
  reviewsDue: number; // decided, with a review date that has come
  reviewsLogged: number; // of those, how many have an outcome
  overdue: number; // review date passed, no outcome yet
  goals: GoalStats[]; // most decisions first
}

const DAY = 86_400_000;
const MONTH_LABEL = new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' });

function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

/** The decisions patterns are drawn from: real ones, optionally only the PM's own. */
export function patternDecisions(state: AppState, mine?: (d: Decision) => boolean): Decision[] {
  return state.decisions.filter((d) => !d.speculative && (!mine || mine(d)));
}

export function decisionStats(state: AppState, decisions: Decision[], today: string): DecisionStats {
  const outcomeOf = new Map(state.outcomes.map((o) => [o.decisionId, o]));
  const decided = decisions.filter((d) => d.status === 'decided');

  const [y, m] = today.split('-').map(Number);
  // Seven months: the six shown, plus one more so the trend can compare six full months.
  const months: MonthCount[] = [];
  for (let back = 6; back >= 0; back--) {
    const at = new Date(Date.UTC(y, m - 1 - back, 1));
    months.push({ key: at.toISOString().slice(0, 7), label: MONTH_LABEL.format(at), year: at.getUTCFullYear(), count: 0 });
  }
  const slot = new Map(months.map((x) => [x.key, x]));
  for (const d of decisions) {
    const hit = slot.get(decisionDate(d).slice(0, 7));
    if (hit) hit.count++;
  }
  const sum = (xs: MonthCount[]) => xs.reduce((n, x) => n + x.count, 0);
  const recent = sum(months.slice(3, 6));
  const before = sum(months.slice(0, 3));
  // Fewer than four decisions in six full months is too few to call a direction.
  const trend =
    recent + before < 4 ? null : recent > before * 1.25 ? 'up' : recent < before * 0.75 ? 'down' : 'steady';

  const days = decided
    .filter((d) => d.loggedAt)
    .map((d) => Math.max(0, Math.round((Date.parse(d.loggedAt!) - Date.parse(d.createdAt)) / DAY)));

  const outcomes = { worked: 0, mixed: 0, 'did-not-work': 0, 'too-early': 0, logged: 0 };
  for (const d of decisions) {
    const o = outcomeOf.get(d.id);
    if (!o) continue;
    outcomes[o.result]++;
    outcomes.logged++;
  }

  const due = decided.filter((d) => d.reviewDate && d.reviewDate <= today);
  const reviewsLogged = due.filter((d) => outcomeOf.has(d.id)).length;

  const goals = new Map<string, GoalStats>();
  for (const d of decisions) {
    const goal = goalOf(d);
    if (!goal) continue;
    const g = goals.get(goal) ?? { goal, count: 0, decided: 0, logged: 0, worked: 0 };
    g.count++;
    if (d.status === 'decided') g.decided++;
    const o = outcomeOf.get(d.id);
    if (o) {
      g.logged++;
      if (o.result === 'worked') g.worked++;
    }
    goals.set(goal, g);
  }

  return {
    total: decisions.length,
    decided: decided.length,
    inProgress: decisions.length - decided.length,
    months: months.slice(1),
    trend,
    trendCounts: { recent, before },
    medianDaysToDecide: median(days),
    outcomes,
    reviewsDue: due.length,
    reviewsLogged,
    overdue: decisions.filter((d) => mapStatus(d, state, today) === 'outcome-due').length,
    goals: [...goals.values()].sort((a, b) => b.count - a.count || a.goal.localeCompare(b.goal)),
  };
}
