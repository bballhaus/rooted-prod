// Synthetic seed data. Every name, company, channel and message here is made up;
// real Slack data never goes into fixtures (AGENTS.md).
import type { AppState, ContextItem, Decision, OptionNode, Source, User } from '../types';

export const demoUser: User = {
  id: 'u-1',
  name: 'Jordan Lee',
  email: 'jordan@fernwave.example',
  role: 'Product manager',
  team: 'Growth',
  company: 'Fernwave',
  plan: 'beta',
  signInProvider: 'google',
  notificationChannel: 'slack',
  defaultReviewDays: 30,
};

export const seedSources: Source[] = [
  {
    id: 'src-slack',
    type: 'slack',
    name: 'Fernwave Slack',
    connected: true,
    connectedAt: '2026-10-01T16:00:00.000Z',
    channels: [
      { id: 'ch-product', name: '#product', memberCount: 24, allowed: true },
      { id: 'ch-growth', name: '#growth', memberCount: 11, allowed: true },
      { id: 'ch-eng', name: '#eng-platform', memberCount: 31, allowed: true },
      { id: 'ch-support', name: '#customer-feedback', memberCount: 18, allowed: true },
      { id: 'ch-sales', name: '#sales', memberCount: 15, allowed: false },
      { id: 'ch-leadership', name: '#leadership', memberCount: 6, allowed: false },
      { id: 'ch-random', name: '#random', memberCount: 52, allowed: false },
    ],
  },
  {
    id: 'src-drive',
    type: 'google-drive',
    name: 'Google Drive',
    connected: false,
    channels: [
      { id: 'fd-prd', name: 'PRDs', memberCount: 0, allowed: true },
      { id: 'fd-research', name: 'User research', memberCount: 0, allowed: true },
      { id: 'fd-finance', name: 'Finance', memberCount: 0, allowed: false },
    ],
  },
];

// Three past decisions, already logged, so the brief can cite them and the
// history list isn't empty on first load.
export const seedDecisions: Decision[] = [
  {
    id: 'd-onboarding-checklist',
    question: 'Should onboarding use a checklist or a guided tour?',
    notes: 'Activation stalled at 31% in August. Support says new admins get lost after inviting teammates.',
    links: [],
    constraints: ['Ship before the September cohort', 'No new eng headcount'],
    deadline: '2026-08-29',
    reviewDate: '2026-10-15',
    status: 'decided',
    createdAt: '2026-08-12T17:00:00.000Z',
    chosenOptionId: 'o-oc-checklist',
    summary: 'Ship a 5-step checklist; skip the guided tour for now.',
    rationale:
      'Interviews showed admins come back to setup over several days, which a checklist supports and a one-time tour does not. The checklist is also two sprints cheaper.',
    loggedAt: '2026-08-27T21:00:00.000Z',
  },
  {
    id: 'd-pricing-seats',
    question: 'Charge per seat or per workspace for the Team plan?',
    notes: 'Sales keeps hearing that per-seat pricing blocks rollouts past the first team.',
    links: [],
    constraints: ['Keep the current Starter plan free'],
    deadline: '2026-09-20',
    reviewDate: '2026-11-20',
    status: 'decided',
    createdAt: '2026-09-02T17:00:00.000Z',
    chosenOptionId: 'o-ps-hybrid',
    summary: 'Per workspace with a seat cap, then per seat above 25.',
    rationale:
      'Removes the friction for small teams that sales flagged while protecting revenue from large accounts.',
    loggedAt: '2026-09-18T19:30:00.000Z',
  },
  {
    id: 'd-mobile-push',
    question: 'Build mobile push notifications this quarter?',
    notes: 'Three enterprise prospects asked for it. Mobile is 9% of weekly actives.',
    links: [],
    constraints: ['One mobile engineer'],
    deadline: '2026-10-03',
    reviewDate: '2026-12-01',
    status: 'decided',
    createdAt: '2026-09-22T17:00:00.000Z',
    chosenOptionId: 'o-mp-email',
    summary: 'Defer push; ship email digests first.',
    rationale: 'Digests reach the 91% of users not on mobile and reuse the existing notification service.',
    loggedAt: '2026-10-02T18:00:00.000Z',
  },
];

export const seedOptions: OptionNode[] = [
  {
    id: 'o-oc-checklist',
    decisionId: 'd-onboarding-checklist',
    parentId: null,
    label: 'Setup checklist',
    summary: 'A persistent 5-step checklist in the sidebar.',
    pros: ['Supports setup over several sessions', 'About one sprint of work'],
    cons: ['Easy to ignore'],
    score: 78,
    contextIds: ['c-seed-1'],
    state: 'chosen',
  },
  {
    id: 'o-oc-tour',
    decisionId: 'd-onboarding-checklist',
    parentId: null,
    label: 'Guided product tour',
    summary: 'A modal walkthrough on first login.',
    pros: ['High completion on first day'],
    cons: ['Skipped by returning admins', 'Three sprints with a vendor SDK'],
    score: 54,
    contextIds: [],
    state: 'pruned',
    pruneReason: 'Admins set up over several days; a one-time tour misses them when they come back.',
  },
  {
    id: 'o-ps-seat',
    decisionId: 'd-pricing-seats',
    parentId: null,
    label: 'Per seat',
    summary: '$22 per editor per month.',
    pros: ['Scales with usage'],
    cons: ['Blocks rollouts past the first team'],
    score: 52,
    contextIds: [],
    state: 'pruned',
    pruneReason: 'Sales flagged it as the main blocker for expanding accounts.',
  },
  {
    id: 'o-ps-hybrid',
    decisionId: 'd-pricing-seats',
    parentId: null,
    label: 'Per workspace with seat cap',
    summary: 'Flat price up to 25 seats, per seat above.',
    pros: ['Easy for small teams', 'Protects large-account revenue'],
    cons: ['Harder to explain on the pricing page'],
    score: 74,
    contextIds: [],
    state: 'chosen',
  },
  {
    id: 'o-mp-push',
    decisionId: 'd-mobile-push',
    parentId: null,
    label: 'Build push now',
    summary: 'iOS and Android push this quarter.',
    pros: ['Unblocks three enterprise deals'],
    cons: ['Only 9% of weekly actives are on mobile', 'Takes the one mobile engineer for the quarter'],
    score: 48,
    contextIds: [],
    state: 'pruned',
    pruneReason: 'Reaches too few users for a full quarter of our only mobile engineer.',
  },
  {
    id: 'o-mp-email',
    decisionId: 'd-mobile-push',
    parentId: null,
    label: 'Email digests first',
    summary: 'Daily or weekly digest emails.',
    pros: ['Reaches everyone', 'Reuses the notification service'],
    cons: ['Doesn’t satisfy the enterprise ask directly'],
    score: 71,
    contextIds: [],
    state: 'chosen',
  },
];

export const seedContextItems: ContextItem[] = [
  {
    id: 'c-seed-1',
    decisionId: 'd-onboarding-checklist',
    origin: 'slack',
    sourceLabel: '#customer-feedback',
    author: 'Priya (Support)',
    date: '2026-08-10',
    snippet: 'Third admin this week who invited the team, left, and came back two days later unsure what was next.',
    group: 'Customer signal',
    flaggedInaccurate: false,
    userEdited: false,
    removed: false,
  },
];

export function seedState(): AppState {
  return {
    user: null,
    sources: structuredClone(seedSources),
    decisions: structuredClone(seedDecisions),
    contextItems: structuredClone(seedContextItems),
    gaps: [],
    options: structuredClone(seedOptions),
    reports: [],
  };
}
