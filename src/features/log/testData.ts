// Synthetic test data for the log feature. All names and messages are made up.
import { signedInState } from '../../test/render';
import type { AppState, ContextItem, Decision, OptionNode } from '../../types';

export const trialDecision: Decision = {
  id: 'd-trial',
  question: 'Should the free trial be 14 or 30 days?',
  notes: 'Trial-to-paid sits at 9%. Most admins invite teammates on day 10 or later.',
  links: [],
  constraints: ['Decide before the Q4 pricing page refresh'],
  deadline: '2026-11-07',
  reviewDate: '2026-12-15',
  status: 'options',
  createdAt: '2026-10-20T17:00:00.000Z',
};

export const trialOptions: OptionNode[] = [
  {
    id: 'o-t-14',
    decisionId: 'd-trial',
    parentId: null,
    label: '14-day trial',
    summary: 'Keep the current 14-day trial.',
    pros: ['No billing changes'],
    cons: ['Ends before most teams invite teammates'],
    score: 55,
    contextIds: [],
    state: 'open',
  },
  {
    id: 'o-t-30',
    decisionId: 'd-trial',
    parentId: null,
    label: '30-day trial',
    summary: 'Extend the trial to 30 days for every workspace.',
    pros: ['Covers the day-10 invite spike', 'Matches two main competitors'],
    cons: ['Delays revenue by two weeks'],
    score: 72,
    contextIds: ['c-t-1'],
    state: 'open',
  },
  {
    id: 'o-t-usage',
    decisionId: 'd-trial',
    parentId: null,
    label: 'Usage-based trial',
    summary: 'Trial ends after 50 shared boards.',
    pros: ['Ties the trial to value'],
    cons: ['Confusing to explain'],
    score: 40,
    contextIds: [],
    state: 'pruned',
    pruneReason: 'Support would field the "why did my trial end" questions; too costly this quarter.',
  },
];

export const trialContext: ContextItem[] = [
  {
    id: 'c-t-1',
    decisionId: 'd-trial',
    origin: 'slack',
    sourceLabel: '#growth',
    author: 'Marcus (Data)',
    date: '2026-10-14',
    snippet: '62% of converting workspaces invited their second teammate after day 10.',
    group: 'Usage data',
    flaggedInaccurate: false,
    userEdited: false,
    removed: false,
  },
  {
    id: 'c-t-2',
    decisionId: 'd-trial',
    origin: 'slack',
    sourceLabel: '#sales',
    author: 'Dana (Sales)',
    date: '2026-10-12',
    snippet: 'Removed note that should not show up.',
    group: 'Customer signal',
    flaggedInaccurate: false,
    userEdited: false,
    removed: true,
  },
];

export function trialState(patch: Partial<AppState> = {}): AppState {
  const base = signedInState();
  return {
    ...base,
    decisions: [structuredClone(trialDecision), ...base.decisions],
    options: [...base.options, ...structuredClone(trialOptions)],
    contextItems: [...base.contextItems, ...structuredClone(trialContext)],
    ...patch,
  };
}
