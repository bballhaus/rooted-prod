// The planted demo forest. Everything here is synthetic — invented names,
// companies, channels, numbers (AGENTS.md). Demo mode loads this so an investor
// or a first-time PM can see what a year of logged, connected decisions looks
// like: past calls that fed current ones, the reasoning behind each, and a few
// speculative directions the PM could still explore.
//
// The shape is a small causal map. `builtOn` draws the edges: a decision points
// back at the earlier decisions it grew out of, and demoState() turns each one
// into an accepted builds-on link. Read left to right and it tells one story
// about Fernwave's growth team over ~six months.
import type { AppState, ContextItem, Decision, DecisionLink, Gap, OptionNode, Outcome } from '../types';
import { demoUser, seedSources } from './fixtures';
import { ME, seedTeammates } from './history';
import { localToday } from '../store/dashboard';

// Written compactly: edges and the outcome sit on the decision here, and are
// split into the store's links and outcomes when the demo loads.
type DemoDecision = Decision & {
  builtOn: string[];
  outcome?: { result: string; metrics?: string; loggedAt: string };
};

// ── Decisions ───────────────────────────────────────────────────────────────
// Three roots (activation, engagement), two chains of past calls, two live
// decisions in flight, and three speculative futures branching off the live work.
const decisions: DemoDecision[] = [
  // Root: the definition everything downstream is measured against.
  {
    id: 'd-activation-metric',
    question: 'How should we define activation?',
    notes: 'We keep arguing about what “activated” means, so every growth decision starts from a different baseline.',
    links: [],
    constraints: ['Has to be measurable in the current analytics'],
    status: 'decided',
    createdAt: '2026-05-07T16:00:00.000Z',
    reviewDate: '2026-06-06',
    chosenOptionId: 'o-am-teammates',
    summary: 'Activation is 3+ teammates active in the first 7 days.',
    rationale:
      'Shared use in the first week was the single strongest predictor of a team still being around in month three. A single-user definition looked good but didn’t predict retention.',
    loggedAt: '2026-05-19T20:00:00.000Z',
    metric: 'Activation',
    horizon: 'past',
    builtOn: [],
    outcome: {
      result: 'Adopted as the team’s north-star activation metric; the first clean baseline came in at 31%.',
      metrics: 'Baseline activation 31%',
      loggedAt: '2026-06-06T17:00:00.000Z',
    },
  },
  {
    id: 'd-onboarding-checklist',
    question: 'Should onboarding use a checklist or a guided tour?',
    notes: 'Activation stalled at 31% in August. Support says new admins get lost after inviting teammates.',
    links: [],
    constraints: ['Ship before the September cohort', 'No new eng headcount'],
    deadline: '2026-07-18',
    reviewDate: '2026-09-03',
    status: 'decided',
    createdAt: '2026-07-01T17:00:00.000Z',
    chosenOptionId: 'o-oc-checklist',
    summary: 'Ship a 5-step checklist; skip the guided tour for now.',
    rationale:
      'Interviews showed admins come back to setup over several days, which a checklist supports and a one-time tour does not. The checklist is also two sprints cheaper and maps cleanly onto the 3-teammates activation metric.',
    loggedAt: '2026-07-16T21:00:00.000Z',
    metric: 'Activation',
    horizon: 'past',
    builtOn: ['d-activation-metric'],
    outcome: {
      result: 'The checklist shipped for the September cohort and activation climbed steadily over six weeks.',
      metrics: 'Activation 31% → 38%',
      loggedAt: '2026-09-03T17:00:00.000Z',
    },
  },
  {
    id: 'd-trial-length',
    question: 'Should the free trial be 14 days or 30 days?',
    notes: 'Sales wants longer trials to close enterprise; self-serve data suggests most teams decide in week one.',
    links: [],
    constraints: ['Keep the Starter plan free'],
    reviewDate: '2026-08-04',
    status: 'decided',
    createdAt: '2026-07-09T17:00:00.000Z',
    chosenOptionId: 'o-tl-14',
    summary: 'Keep the 14-day trial; add a one-click extension for sales-assisted deals.',
    rationale:
      'Trial-to-paid barely moved between 14 and 30 days in last year’s test, and shorter trials kept the sales cycle tight. The extension covers the enterprise edge case without slowing everyone down.',
    loggedAt: '2026-07-22T19:00:00.000Z',
    metric: 'Trial → paid',
    horizon: 'past',
    builtOn: ['d-activation-metric'],
    outcome: {
      result: 'Trial-to-paid held steady and the median sales cycle shortened by four days.',
      metrics: 'Trial → paid 11.8%',
      loggedAt: '2026-08-04T17:00:00.000Z',
    },
  },
  {
    id: 'd-pricing-seats',
    question: 'Charge per seat or per workspace for the Team plan?',
    notes: 'Sales keeps hearing that per-seat pricing blocks rollouts past the first team.',
    links: [],
    constraints: ['Keep the current Starter plan free'],
    deadline: '2026-08-09',
    reviewDate: '2026-10-09',
    status: 'decided',
    createdAt: '2026-07-22T17:00:00.000Z',
    chosenOptionId: 'o-ps-hybrid',
    summary: 'Per workspace with a seat cap, then per seat above 25.',
    rationale:
      'Removes the friction for small teams that sales flagged while protecting revenue from large accounts. Pairs with the shorter trial: teams commit sooner, so flat pricing lowers the barrier to spreading internally.',
    loggedAt: '2026-08-07T19:30:00.000Z',
    metric: 'Expansion',
    horizon: 'past',
    builtOn: ['d-trial-length'],
    outcome: {
      result: 'Two rollouts that had stalled on per-seat pricing reopened within a month of the change.',
      metrics: 'Net revenue retention +4 pts',
      loggedAt: '2026-10-09T18:00:00.000Z',
    },
  },
  {
    id: 'd-mobile-push',
    question: 'Build mobile push notifications this quarter?',
    notes: 'Three enterprise prospects asked for it. Mobile is 9% of weekly actives.',
    links: [],
    constraints: ['One mobile engineer'],
    deadline: '2026-08-22',
    reviewDate: '2026-10-20',
    status: 'decided',
    createdAt: '2026-08-11T17:00:00.000Z',
    chosenOptionId: 'o-mp-email',
    summary: 'Defer push; ship email digests first.',
    rationale: 'Digests reach the 91% of users not on mobile and reuse the existing notification service.',
    loggedAt: '2026-08-21T18:00:00.000Z',
    metric: 'Engagement',
    horizon: 'past',
    builtOn: [],
    outcome: {
      result: 'Email digests shipped in three weeks and landed well; push stayed on the shelf.',
      metrics: 'Digest open rate 42%',
      loggedAt: '2026-10-20T18:00:00.000Z',
    },
  },
  {
    id: 'd-weekly-digest',
    question: 'Send the activity digest daily or weekly?',
    notes: 'Now that digests replaced push, we need a cadence that informs without becoming noise.',
    links: [],
    constraints: ['Reuse the digest service we just built'],
    reviewDate: '2026-10-19',
    status: 'decided',
    createdAt: '2026-09-02T17:00:00.000Z',
    chosenOptionId: 'o-wd-weekly',
    summary: 'Weekly digest, with per-user controls to go daily.',
    rationale:
      'A weekly cadence kept unsubscribes low in the pilot while still pulling people back. Daily felt like noise to most teams; the opt-in covers the few who want more.',
    loggedAt: '2026-09-16T18:00:00.000Z',
    metric: 'Engagement',
    horizon: 'past',
    builtOn: ['d-mobile-push'],
    outcome: {
      result: 'Weekly won on return visits without raising unsubscribes; a small power-user segment opted into daily.',
      metrics: 'Unsubscribe rate under 1%',
      loggedAt: '2026-10-19T18:00:00.000Z',
    },
  },

  // ── Live decisions (in flight) ──────────────────────────────────────────
  {
    id: 'd-self-serve-expansion',
    question: 'How do we drive expansion revenue inside existing accounts?',
    notes:
      'Activation and retention are healthy, but revenue per account is flat. The pricing change opened the door; now we need a motion that grows accounts without a sales rep on every one.',
    links: [],
    constraints: ['No net-new pricing changes this quarter', 'Reuse the usage data we already collect'],
    deadline: '2026-12-04',
    reviewDate: '2027-01-17',
    status: 'options',
    createdAt: '2026-10-14T17:00:00.000Z',
    metric: 'Expansion',
    horizon: 'now',
    builtOn: ['d-pricing-seats', 'd-onboarding-checklist', 'd-activation-metric'],
  },
  {
    id: 'd-sso-enterprise',
    question: 'Build SSO and SAML this quarter for enterprise deals?',
    notes:
      'Two six-figure deals name SSO as a blocker. It’s real work, and it only helps the top of the market, so we need to be sure before committing the quarter.',
    links: [],
    constraints: ['Security review required before launch'],
    deadline: '2026-12-21',
    reviewDate: '2027-02-01',
    status: 'brief',
    createdAt: '2026-10-27T17:00:00.000Z',
    metric: 'Enterprise',
    horizon: 'now',
    builtOn: ['d-pricing-seats'],
  },

  // ── Speculative futures (demo navigation) ───────────────────────────────
  // These are not real plans. They’re directions the PM can step into from the
  // live decisions to see where a path might lead.
  {
    id: 'd-future-usage-pricing',
    question: 'Move the Team plan to usage-based pricing?',
    notes:
      'If in-product expansion works, usage-based pricing could capture more of the value we create — but it’s a big bet that reshapes every account’s bill.',
    links: [],
    constraints: [],
    status: 'framing',
    createdAt: '2026-12-09T17:00:00.000Z',
    metric: 'Expansion',
    horizon: 'future',
    speculative: true,
    builtOn: ['d-self-serve-expansion', 'd-pricing-seats'],
  },
  {
    id: 'd-future-plg',
    question: 'Add a self-serve PLG motion alongside sales?',
    notes:
      'Expansion nudges that work on their own hint that teams can grow without a rep. A product-led motion could widen the funnel — if support and billing can carry it.',
    links: [],
    constraints: [],
    status: 'framing',
    createdAt: '2026-12-09T17:00:00.000Z',
    metric: 'Growth',
    horizon: 'future',
    speculative: true,
    builtOn: ['d-self-serve-expansion'],
  },
  {
    id: 'd-future-enterprise-tier',
    question: 'Launch a dedicated Enterprise tier?',
    notes:
      'With SSO shipped, an Enterprise tier (audit log, roles, residency) could anchor the top of the market — but it commits us to a second product surface to support.',
    links: [],
    constraints: [],
    status: 'framing',
    createdAt: '2026-12-25T17:00:00.000Z',
    metric: 'Enterprise',
    horizon: 'future',
    speculative: true,
    builtOn: ['d-sso-enterprise', 'd-pricing-seats'],
  },
];

// Teammates' decisions, so the Org scope shows cross-team lineage. Some build
// on the PM's calls above. All synthetic.
const orgDecisions: DemoDecision[] = [
  {
    id: 'o-design-system',
    question: 'Adopt a shared design system across the product?',
    notes: 'Teams keep rebuilding the same components; a shared system would cut rework.',
    links: [],
    constraints: [],
    status: 'decided',
    createdAt: '2026-05-24T16:00:00.000Z',
    summary: 'Adopt a single design system, migrate surface by surface.',
    rationale: 'Shared components cut duplicate work and keep the product coherent as teams grow.',
    loggedAt: '2026-06-08T18:00:00.000Z',
    metric: 'Velocity',
    horizon: 'past',
    ownerId: 'tm-maya',
    builtOn: [],
  },
  {
    id: 'o-api-v2',
    question: 'Ship API v2 with breaking changes?',
    notes: 'The pricing change needs usage metering the current API can’t express cleanly.',
    links: [],
    constraints: [],
    status: 'decided',
    createdAt: '2026-08-14T16:00:00.000Z',
    summary: 'Ship v2 behind a version header; keep v1 for a year.',
    rationale: 'A clean v2 unblocks metered pricing while v1 keeps existing integrations working.',
    loggedAt: '2026-08-29T18:00:00.000Z',
    metric: 'Platform',
    horizon: 'past',
    ownerId: 'tm-dev',
    builtOn: ['d-pricing-seats'],
  },
  {
    id: 'o-analytics',
    question: 'Build in-product analytics dashboards?',
    notes: 'Digests landed well; teams now ask to see their own activity trends in-app.',
    links: [],
    constraints: [],
    status: 'decided',
    createdAt: '2026-09-21T16:00:00.000Z',
    summary: 'Ship a first dashboard for admins, reusing the digest data.',
    rationale: 'Reuses the digest pipeline and answers the most common “can I see trends” ask.',
    loggedAt: '2026-10-07T18:00:00.000Z',
    metric: 'Engagement',
    horizon: 'past',
    ownerId: 'tm-dev',
    builtOn: ['d-mobile-push'],
  },
  {
    id: 'o-support-tier',
    question: 'Add a premium support tier for larger accounts?',
    notes: 'Expansion accounts are asking for faster response times and a named contact.',
    links: [],
    constraints: [],
    status: 'options',
    createdAt: '2026-10-20T16:00:00.000Z',
    metric: 'Enterprise',
    horizon: 'now',
    ownerId: 'tm-priya',
    builtOn: ['d-pricing-seats'],
  },
  {
    id: 'o-data-residency',
    question: 'Offer EU data residency?',
    notes: 'Two enterprise prospects need data kept in-region to pass procurement.',
    links: [],
    constraints: [],
    status: 'brief',
    createdAt: '2026-10-29T16:00:00.000Z',
    metric: 'Enterprise',
    horizon: 'now',
    ownerId: 'tm-theo',
    builtOn: ['d-sso-enterprise'],
  },
  {
    id: 'o-brand-refresh',
    question: 'Refresh the brand next year?',
    notes: 'The look is dated next to newer competitors; a refresh could lift conversion.',
    links: [],
    constraints: [],
    status: 'framing',
    createdAt: '2026-12-04T16:00:00.000Z',
    metric: 'Growth',
    horizon: 'future',
    speculative: true,
    ownerId: 'tm-maya',
    builtOn: ['o-design-system'],
  },
];

// ── Options ─────────────────────────────────────────────────────────────────
// Decided decisions keep their chosen branch plus the ones they pruned, each
// with its reason. Live decisions carry an open tree. Futures carry a couple of
// open paths so stepping into one shows directions to explore.
const options: OptionNode[] = [
  // d-activation-metric
  {
    id: 'o-am-teammates',
    decisionId: 'd-activation-metric',
    parentId: null,
    label: '3+ teammates in 7 days',
    summary: 'Count a team as activated when three or more members are active within the first week.',
    pros: ['Strongest predictor of month-3 retention', 'Measurable in the current analytics'],
    cons: ['Harder for solo trials to hit'],
    score: 80,
    criteria: { impact: 5, effort: 2, risk: 2, evidence: 4 },
    contextIds: ['c-am-1'],
    state: 'chosen',
  },
  {
    id: 'o-am-single',
    decisionId: 'd-activation-metric',
    parentId: null,
    label: 'One key action',
    summary: 'Activation = the admin completes one core action (creates a board).',
    pros: ['Easy to hit, looks good on a dashboard'],
    cons: ['Didn’t predict retention in the data'],
    score: 48,
    criteria: { impact: 2, effort: 1, risk: 3, evidence: 3 },
    contextIds: [],
    state: 'pruned',
    pruneReason: 'A single action was easy to hit but didn’t predict whether a team stuck around.',
  },

  // d-onboarding-checklist
  {
    id: 'o-oc-checklist',
    decisionId: 'd-onboarding-checklist',
    parentId: null,
    label: 'Setup checklist',
    summary: 'A persistent 5-step checklist in the sidebar.',
    pros: ['Supports setup over several sessions', 'About one sprint of work'],
    cons: ['Easy to ignore'],
    score: 78,
    criteria: { impact: 4, effort: 2, risk: 2, evidence: 4 },
    contextIds: ['c-oc-1'],
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
    criteria: { impact: 3, effort: 4, risk: 3, evidence: 2 },
    contextIds: [],
    state: 'pruned',
    pruneReason: 'Admins set up over several days; a one-time tour misses them when they come back.',
  },

  // d-trial-length
  {
    id: 'o-tl-14',
    decisionId: 'd-trial-length',
    parentId: null,
    label: 'Keep 14 days',
    summary: 'Hold the 14-day trial and add a one-click extension for sales-assisted deals.',
    pros: ['Keeps the sales cycle tight', 'Most teams decide in week one'],
    cons: ['Enterprise sometimes wants longer'],
    score: 72,
    criteria: { impact: 4, effort: 2, risk: 2, evidence: 4 },
    contextIds: ['c-tl-1'],
    state: 'chosen',
  },
  {
    id: 'o-tl-30',
    decisionId: 'd-trial-length',
    parentId: null,
    label: 'Extend to 30 days',
    summary: 'Give every workspace a 30-day trial.',
    pros: ['More time for larger teams to evaluate'],
    cons: ['Trial-to-paid barely moved in last year’s test', 'Slows the sales cycle'],
    score: 51,
    criteria: { impact: 2, effort: 2, risk: 3, evidence: 3 },
    contextIds: [],
    state: 'pruned',
    pruneReason: 'Last year’s test showed almost no lift in trial-to-paid from the extra two weeks.',
  },

  // d-pricing-seats
  {
    id: 'o-ps-seat',
    decisionId: 'd-pricing-seats',
    parentId: null,
    label: 'Per seat',
    summary: '$22 per editor per month.',
    pros: ['Scales with usage'],
    cons: ['Blocks rollouts past the first team'],
    score: 52,
    criteria: { impact: 3, effort: 1, risk: 3, evidence: 3 },
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
    criteria: { impact: 4, effort: 3, risk: 2, evidence: 4 },
    contextIds: ['c-ps-1'],
    state: 'chosen',
  },

  // d-mobile-push
  {
    id: 'o-mp-push',
    decisionId: 'd-mobile-push',
    parentId: null,
    label: 'Build push now',
    summary: 'iOS and Android push this quarter.',
    pros: ['Unblocks three enterprise deals'],
    cons: ['Only 9% of weekly actives are on mobile', 'Takes the one mobile engineer for the quarter'],
    score: 48,
    criteria: { impact: 2, effort: 5, risk: 3, evidence: 3 },
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
    criteria: { impact: 4, effort: 2, risk: 1, evidence: 4 },
    contextIds: ['c-mp-1'],
    state: 'chosen',
  },

  // d-weekly-digest
  {
    id: 'o-wd-weekly',
    decisionId: 'd-weekly-digest',
    parentId: null,
    label: 'Weekly',
    summary: 'One weekly digest, with a per-user option to switch to daily.',
    pros: ['Low unsubscribe rate in the pilot', 'Still pulls people back'],
    cons: ['Slower to surface time-sensitive activity'],
    score: 70,
    criteria: { impact: 4, effort: 2, risk: 1, evidence: 4 },
    contextIds: [],
    state: 'chosen',
  },
  {
    id: 'o-wd-daily',
    decisionId: 'd-weekly-digest',
    parentId: null,
    label: 'Daily',
    summary: 'A daily digest for everyone.',
    pros: ['Surfaces activity quickly'],
    cons: ['Felt like noise to most teams in the pilot'],
    score: 45,
    criteria: { impact: 2, effort: 2, risk: 4, evidence: 3 },
    contextIds: [],
    state: 'pruned',
    pruneReason: 'Daily read as noise for most teams and pushed unsubscribes up in the pilot.',
  },

  // ── d-self-serve-expansion: the live option tree ────────────────────────
  {
    id: 'o-sse-usage',
    decisionId: 'd-self-serve-expansion',
    parentId: null,
    label: 'In-product usage nudges',
    summary: 'Surface a gentle upgrade prompt when a team approaches a plan limit or unlocks a paid-tier action.',
    pros: ['Runs on usage data we already collect', 'Scales without a rep on every account'],
    cons: ['Risk of feeling naggy if mistuned'],
    score: 76,
    criteria: { impact: 4, effort: 2, risk: 3, evidence: 4 },
    contextIds: ['c-sse-1', 'c-sse-2'],
    state: 'open',
  },
  {
    id: 'o-sse-tiers',
    decisionId: 'd-self-serve-expansion',
    parentId: null,
    label: 'Repackage into value tiers',
    summary: 'Move a few high-value features into a higher tier so growing teams have a reason to move up.',
    pros: ['Clear upgrade path', 'Lifts revenue per account'],
    cons: ['Touches packaging — close to the “no pricing changes” constraint', 'Can upset current customers'],
    score: 58,
    criteria: { impact: 4, effort: 3, risk: 4, evidence: 3 },
    contextIds: ['c-sse-3'],
    state: 'open',
  },
  {
    id: 'o-sse-success',
    decisionId: 'd-self-serve-expansion',
    parentId: null,
    label: 'Human-led account success',
    summary: 'Assign a CS owner to the top 50 accounts and drive expansion through quarterly reviews.',
    pros: ['High-touch, works for big accounts'],
    cons: ['Doesn’t scale to the long tail', 'Needs headcount we don’t have'],
    score: 49,
    criteria: { impact: 3, effort: 4, risk: 2, evidence: 2 },
    contextIds: [],
    state: 'open',
  },
  {
    id: 'o-sse-defer',
    decisionId: 'd-self-serve-expansion',
    parentId: null,
    label: 'Gather more evidence first',
    summary: 'Run 8 account interviews on where teams naturally want to grow before committing.',
    pros: ['Answers “why” before we build', 'Cheapest branch this week'],
    cons: ['Delays any revenue impact'],
    score: 44,
    criteria: { impact: 2, effort: 1, risk: 1, evidence: 2 },
    contextIds: [],
    state: 'open',
  },
  // sub-options under the leading branch (rollout split)
  {
    id: 'o-sse-usage-pilot',
    decisionId: 'd-self-serve-expansion',
    parentId: 'o-sse-usage',
    label: 'Pilot with 5 design partners',
    summary: 'In-product usage nudges, tried first with 5 design-partner accounts for two weeks.',
    pros: ['Real feedback before a wide launch', 'Easy to roll back'],
    cons: ['Small sample; may not hold for the long tail'],
    score: 72,
    criteria: { impact: 3, effort: 1, risk: 1, evidence: 4 },
    contextIds: ['c-sse-1'],
    state: 'open',
  },
  {
    id: 'o-sse-usage-all',
    decisionId: 'd-self-serve-expansion',
    parentId: 'o-sse-usage',
    label: 'All accounts, behind a flag',
    summary: 'In-product usage nudges for every workspace, behind a feature flag the team can turn off.',
    pros: ['Fastest path to full impact'],
    cons: ['Support load lands all at once', 'Harder to attribute the lift'],
    score: 74,
    criteria: { impact: 5, effort: 2, risk: 3, evidence: 4 },
    contextIds: ['c-sse-2'],
    state: 'open',
  },

  // ── Speculative futures: a couple of open paths each ─────────────────────
  {
    id: 'o-fup-full',
    decisionId: 'd-future-usage-pricing',
    parentId: null,
    label: 'Full usage-based pricing',
    summary: 'Bill every account on metered usage, retiring flat tiers over a migration window.',
    pros: ['Captures the value we create', 'Aligns price with heavy use'],
    cons: ['Reshapes every bill', 'Unpredictable for customers to budget'],
    score: 55,
    criteria: { impact: 5, effort: 5, risk: 5, evidence: 2 },
    contextIds: [],
    state: 'open',
  },
  {
    id: 'o-fup-hybrid',
    decisionId: 'd-future-usage-pricing',
    parentId: null,
    label: 'Flat base plus usage',
    summary: 'Keep a flat base and add metered usage above an included allowance.',
    pros: ['Predictable floor for customers', 'Still captures upside'],
    cons: ['More complex to explain and meter'],
    score: 62,
    criteria: { impact: 4, effort: 4, risk: 3, evidence: 2 },
    contextIds: [],
    state: 'open',
  },
  {
    id: 'o-fplg-light',
    decisionId: 'd-future-plg',
    parentId: null,
    label: 'Self-serve upgrade only',
    summary: 'Let teams upgrade and expand entirely in-product, keeping sales for inbound enterprise.',
    pros: ['Widens the funnel', 'Builds on the expansion nudges'],
    cons: ['Support and billing must carry more'],
    score: 60,
    criteria: { impact: 4, effort: 3, risk: 3, evidence: 2 },
    contextIds: [],
    state: 'open',
  },
  {
    id: 'o-fplg-full',
    decisionId: 'd-future-plg',
    parentId: null,
    label: 'Full PLG motion',
    summary: 'Re-orient the whole funnel around product-led growth, with sales as an overlay.',
    pros: ['Lower cost of acquisition at scale'],
    cons: ['A big organizational change', 'Enterprise still needs a rep'],
    score: 48,
    criteria: { impact: 5, effort: 5, risk: 5, evidence: 1 },
    contextIds: [],
    state: 'open',
  },
  {
    id: 'o-fet-tier',
    decisionId: 'd-future-enterprise-tier',
    parentId: null,
    label: 'Launch an Enterprise tier',
    summary: 'Bundle SSO, audit log, roles and residency into a priced Enterprise tier.',
    pros: ['Anchors the top of the market', 'Clear home for enterprise asks'],
    cons: ['A second surface to support', 'Needs admin and compliance work'],
    score: 57,
    criteria: { impact: 4, effort: 4, risk: 3, evidence: 2 },
    contextIds: [],
    state: 'open',
  },
  {
    id: 'o-fet-addons',
    decisionId: 'd-future-enterprise-tier',
    parentId: null,
    label: 'Sell enterprise features à la carte',
    summary: 'Offer SSO and audit log as paid add-ons on the Team plan instead of a tier.',
    pros: ['Lower lift', 'Lets teams buy only what they need'],
    cons: ['Weaker positioning', 'Harder to upsell the full bundle'],
    score: 50,
    criteria: { impact: 3, effort: 2, risk: 2, evidence: 2 },
    contextIds: [],
    state: 'open',
  },
];

// ── Context items ─────────────────────────────────────────────────────────
// A little evidence behind the chosen past calls and the live decisions, so the
// option cards and the inspector have real snippets to show. All synthetic.
const contextItems: ContextItem[] = [
  {
    id: 'c-am-1',
    decisionId: 'd-activation-metric',
    origin: 'drive',
    sourceLabel: 'Retention cohort analysis',
    author: 'Data team',
    date: '2026-05-09',
    snippet: 'Teams with 3+ active members in week one retained at 2.1× the rate of single-user trials.',
    group: 'Activation',
    flaggedInaccurate: false,
    userEdited: false,
    removed: false,
  },
  {
    id: 'c-oc-1',
    decisionId: 'd-onboarding-checklist',
    origin: 'slack',
    sourceLabel: '#customer-feedback',
    author: 'Priya (Support)',
    date: '2026-06-29',
    snippet: 'Third admin this week who invited the team, left, and came back two days later unsure what was next.',
    group: 'Customer signal',
    flaggedInaccurate: false,
    userEdited: false,
    removed: false,
  },
  {
    id: 'c-tl-1',
    decisionId: 'd-trial-length',
    origin: 'drive',
    sourceLabel: 'Trial length A/B, 2025',
    author: 'Growth',
    date: '2026-07-07',
    snippet: '14 vs 30-day trials converted within 0.3 points of each other; 30-day just delayed the decision.',
    group: 'Trials and conversion',
    flaggedInaccurate: false,
    userEdited: false,
    removed: false,
  },
  {
    id: 'c-ps-1',
    decisionId: 'd-pricing-seats',
    origin: 'slack',
    sourceLabel: '#growth',
    author: 'Marcus (Sales)',
    date: '2026-07-25',
    snippet: 'Lost the Northwind expansion because adding 12 seats tripled their bill overnight.',
    group: 'Pricing and packaging',
    flaggedInaccurate: false,
    userEdited: false,
    removed: false,
  },
  {
    id: 'c-mp-1',
    decisionId: 'd-mobile-push',
    origin: 'slack',
    sourceLabel: '#product',
    author: 'Dana (PM)',
    date: '2026-08-13',
    snippet: 'Mobile is 9% of weekly actives. A digest reuses the service we already run for weekly emails.',
    group: 'Engagement',
    flaggedInaccurate: false,
    userEdited: false,
    removed: false,
  },
  {
    id: 'c-sse-1',
    decisionId: 'd-self-serve-expansion',
    origin: 'slack',
    sourceLabel: '#growth',
    author: 'Marcus (Sales)',
    date: '2026-10-10',
    snippet: 'Accounts that hit the board limit are our best expansion signal — most upgrade within a week if we ask.',
    group: 'Expansion',
    flaggedInaccurate: false,
    userEdited: false,
    removed: false,
  },
  {
    id: 'c-sse-2',
    decisionId: 'd-self-serve-expansion',
    origin: 'drive',
    sourceLabel: 'Usage limits report',
    author: 'Data team',
    date: '2026-10-11',
    snippet: '38% of Team accounts brushed a plan limit last quarter; only 9% were ever contacted about upgrading.',
    group: 'Expansion',
    flaggedInaccurate: false,
    userEdited: false,
    removed: false,
  },
  {
    id: 'c-sse-3',
    decisionId: 'd-self-serve-expansion',
    origin: 'slack',
    sourceLabel: '#product',
    author: 'Dana (PM)',
    date: '2026-10-13',
    snippet: 'Repackaging is tempting but we promised customers no surprise price moves this year.',
    group: 'Packaging',
    flaggedInaccurate: false,
    userEdited: false,
    removed: false,
  },
  {
    id: 'c-sso-1',
    decisionId: 'd-sso-enterprise',
    origin: 'slack',
    sourceLabel: '#growth',
    author: 'Marcus (Sales)',
    date: '2026-10-24',
    snippet: 'Both the Aldridge and Beacon deals list SSO as a hard requirement for security sign-off.',
    group: 'Enterprise',
    flaggedInaccurate: false,
    userEdited: false,
    removed: false,
  },
  {
    id: 'c-sso-2',
    decisionId: 'd-sso-enterprise',
    origin: 'drive',
    sourceLabel: 'Security questionnaire (Aldridge)',
    author: 'Aldridge IT',
    date: '2026-10-25',
    snippet: 'SAML SSO and SCIM provisioning are required; without them procurement cannot approve.',
    group: 'Enterprise',
    flaggedInaccurate: false,
    userEdited: false,
    removed: false,
  },
];

// ── Gaps ───────────────────────────────────────────────────────────────────
const gaps: Gap[] = [
  {
    id: 'd-sso-enterprise-gap-1',
    decisionId: 'd-sso-enterprise',
    question: 'How much Enterprise pipeline actually depends on SSO beyond the two named deals?',
  },
  {
    id: 'd-sso-enterprise-gap-2',
    decisionId: 'd-sso-enterprise',
    question: 'What does the security review require before SSO can ship? No scope has been written down yet.',
  },
  {
    id: 'd-self-serve-expansion-gap-1',
    decisionId: 'd-self-serve-expansion',
    question: 'What lift in revenue per account would make the usage-nudge work worth a quarter of eng time?',
  },
];

// The demo is written as of this day. Each load moves every date by the days
// since, so the past stays past and the directions stay ahead of today.
const WRITTEN_ON = '2026-11-02';
const DAY = 86_400_000;

function shiftDates<T>(value: T, days: number): T {
  if (days === 0) return value;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}(T|$)/.test(value)) {
    const date = value.length === 10 ? `${value}T00:00:00.000Z` : value;
    const moved = new Date(Date.parse(date) + days * DAY).toISOString();
    return (value.length === 10 ? moved.slice(0, 10) : moved) as T;
  }
  if (Array.isArray(value)) return value.map((v) => shiftDates(v, days)) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, shiftDates(v, days)])) as T;
  }
  return value;
}

/** The planted demo forest, dated relative to `today` (the PM's local day). */
export function demoState(today: string = localToday()): AppState {
  const days = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${WRITTEN_ON}T00:00:00Z`)) / DAY);
  return shiftDates(plantedState(), days);
}

function plantedState(): AppState {
  const sources = structuredClone(seedSources);
  // In the demo, both sources are connected so the brief and evidence read full.
  for (const s of sources) {
    s.connected = true;
    if (!s.connectedAt) s.connectedAt = '2026-03-23T16:00:00.000Z';
  }
  const all = [...decisions, ...orgDecisions];
  const links: DecisionLink[] = all.flatMap((d) =>
    d.builtOn.map((fromId) => ({
      id: `demo-link-${fromId}-${d.id}`,
      fromId,
      toId: d.id,
      kind: 'builds-on' as const,
      origin: 'user' as const,
      status: 'accepted' as const,
    })),
  );
  const outcomes: Outcome[] = all.flatMap((d) =>
    d.outcome
      ? [
          {
            id: `demo-out-${d.id}`,
            decisionId: d.id,
            result: 'worked' as const,
            summary: d.outcome.result,
            metrics: d.outcome.metrics ?? '',
            loggedAt: d.outcome.loggedAt,
          },
        ]
      : [],
  );
  return {
    user: structuredClone(demoUser),
    sources,
    decisions: all.map(({ builtOn: _builtOn, outcome: _outcome, ...d }) => ({ ...d, ownerId: d.ownerId ?? ME })),
    contextItems: structuredClone(contextItems),
    gaps: structuredClone(gaps),
    options: structuredClone(options),
    reports: [],
    teammates: structuredClone(seedTeammates),
    links,
    outcomes,
    suggestions: [],
    messages: [],
    insights: [],
    demo: true,
  };
}
