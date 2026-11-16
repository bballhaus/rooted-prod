// F-R3-05 (decision 0019): patterns, trends and predictions across the PM's
// decisions. Rooted sends Claude each decision's question, choice, reasoning,
// what it passed on and how it turned out, plus the counts from
// store/patterns.ts. What comes back is Rooted's (✦): every insight cites real
// decisions, and the PM can edit, dismiss or report it (F-08, F-28).
import { goalOf, mapStatus, ownerOf } from '../store/dashboard';
import type { DecisionStats } from '../store/patterns';
import type { AppState, Decision, Insight } from '../types';
import { decisionSummary } from './brief';
import { AiError, fit, LIMITS, type AiClient } from './client';

/** Fewer decided decisions than this, and there's no history to find patterns in yet. */
export const MIN_DECIDED_FOR_PATTERNS = 3;

type Found = Omit<Insight, 'id' | 'foundAt' | 'userEdited' | 'dismissed'>;

export function historyOf(d: Decision, state: AppState, today: string) {
  const outcome = state.outcomes.find((o) => o.decisionId === d.id);
  return {
    ...decisionSummary(d, state),
    status: mapStatus(d, state, today),
    goal: goalOf(d) ?? null,
    owner: ownerOf(d, state)?.name ?? null,
    started: d.createdAt.slice(0, 10),
    reviewDate: d.reviewDate ?? null,
    notTaken: state.options
      .filter((o) => o.decisionId === d.id && o.state === 'pruned')
      .slice(0, 20)
      .map((o) => fit(o.label, LIMITS.constraint)),
    outcome: outcome ? { result: outcome.result, summary: fit(outcome.summary, LIMITS.summary) } : null,
  };
}

export async function findPatterns(
  ai: AiClient,
  state: AppState,
  decisions: Decision[],
  stats: DecisionStats,
  today: string,
  now = new Date(),
): Promise<Insight[]> {
  // Not enough history means nothing worth paying Claude to look at.
  if (decisions.filter((d) => d.status === 'decided').length < MIN_DECIDED_FOR_PATTERNS) throw new AiError('nothing_to_read');
  const result = await ai.run<{ insights: Found[] }>('findPatterns', {
    today,
    decisions: decisions.slice(0, 300).map((d) => historyOf(d, state, today)),
    stats: {
      total: stats.total,
      decided: stats.decided,
      inProgress: stats.inProgress,
      // The last month is the current one, still under way.
      perMonth: stats.months.map((m, i) => ({ month: m.key, decisions: m.count, partial: i === stats.months.length - 1 })),
      trend: stats.trend,
      trendCounts: stats.trendCounts,
      medianDaysToDecide: stats.medianDaysToDecide,
      outcomes: stats.outcomes,
      reviewsDue: stats.reviewsDue,
      reviewsLogged: stats.reviewsLogged,
      overdue: stats.overdue,
      goals: stats.goals,
    },
  });
  const stamp = now.getTime().toString(36);
  return result.insights.map((i, n) => ({
    id: `in-${stamp}-${n}`,
    kind: i.kind,
    title: i.title,
    detail: i.detail,
    decisionIds: i.decisionIds,
    confidence: i.confidence,
    ...(i.watchFor ? { watchFor: i.watchFor } : {}),
    foundAt: now.toISOString(),
    userEdited: false,
    dismissed: false,
  }));
}
