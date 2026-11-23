// F-23: the PM's decisions as one Markdown file they can keep, before deleting
// their data or just to have a copy. Built from the store; nothing is sent anywhere.
import { formatDate, STATUS_LABEL } from '../features/log/format';
import { RESULT_LABEL } from '../features/log/outcome';
import type { AppState } from '../types';
import { chosenLabel, ownerOf } from './dashboard';
import { pathLabel } from './tree';

export function decisionsMarkdown(state: AppState, now = new Date()): string {
  const out = [`# Decisions from Rooted`, '', `Exported ${formatDate(now.toISOString())}.`, ''];
  const decisions = [...state.decisions].sort((a, b) => (b.loggedAt ?? b.createdAt).localeCompare(a.loggedAt ?? a.createdAt));
  if (decisions.length === 0) out.push('No decisions yet.', '');
  for (const d of decisions) {
    const options = state.options.filter((o) => o.decisionId === d.id);
    const outcome = state.outcomes.find((o) => o.decisionId === d.id);
    const chosen = chosenLabel(d, state);
    out.push(`## ${d.question}`, '');
    const facts = [
      `Status: ${STATUS_LABEL[d.status]}`,
      `Owner: ${ownerOf(d, state)?.name ?? 'Unknown'}`,
      d.loggedAt ? `Logged: ${formatDate(d.loggedAt)}` : `Started: ${formatDate(d.createdAt)}`,
      d.deadline && `Deadline: ${formatDate(d.deadline)}`,
      d.reviewDate && `Review date: ${formatDate(d.reviewDate)}`,
      (d.tags ?? []).length > 0 && `Tags: ${(d.tags ?? []).map((t) => `#${t.label}`).join(' ')}`,
    ].filter(Boolean);
    out.push(...facts.map((f) => `- ${f}`), '');
    if (d.notes) out.push(d.notes, '');
    if (chosen) {
      out.push(`**Chose:** ${pathLabel(options, d.chosenOptionId!)}`, '');
      if (d.summary) out.push(d.summary, '');
      if (d.rationale) out.push(`**Why:** ${d.rationale}`, '');
    }
    const pruned = options.filter((o) => o.state === 'pruned');
    if (pruned.length > 0) {
      out.push('**Options not taken:**', '');
      out.push(...pruned.map((o) => `- ${o.label}: ${o.pruneReason || 'No reason given.'}`), '');
    }
    const open = options.filter((o) => o.state === 'open');
    if (!chosen && open.length > 0) {
      out.push('**Options on the table:**', '');
      out.push(...open.map((o) => `- ${o.label}${o.summary ? `: ${o.summary}` : ''}`), '');
    }
    if (outcome) {
      out.push(`**Outcome (${formatDate(outcome.loggedAt)}):** ${RESULT_LABEL[outcome.result]}. ${outcome.summary}`.trim(), '');
      if (outcome.metrics) out.push(`Metrics: ${outcome.metrics}`, '');
    }
  }
  return out.join('\n');
}
