// Synthetic decision history for the map: fake teammates, a few months of
// logged decisions, links between them, outcomes and decisions the agent thinks
// are coming up. Every name, number and message is made up for the Fernwave demo
// and matches the people in slackCorpus.ts. Real Slack data never goes here.
import type {
  Decision,
  DecisionLink,
  OptionNode,
  Outcome,
  SuggestedDecision,
  Tag,
  Teammate,
} from '../types';

export const ME = 'u-1';

export const seedTeammates: Teammate[] = [
  { id: ME, name: 'Jordan Lee', role: 'Product manager', team: 'Growth', initials: 'JL' },
  { id: 'tm-rafael', name: 'Rafael Ortiz', role: 'Head of product', team: 'Product', initials: 'RO' },
  { id: 'tm-theo', name: 'Theo Park', role: 'Product manager', team: 'Core', initials: 'TP' },
  { id: 'tm-maya', name: 'Maya Torres', role: 'Design lead', team: 'Design', initials: 'MT' },
  { id: 'tm-dev', name: 'Dev Patel', role: 'Staff engineer', team: 'Platform', initials: 'DP' },
  { id: 'tm-ines', name: 'Ines Moreau', role: 'Growth analyst', team: 'Growth', initials: 'IM' },
  { id: 'tm-priya', name: 'Priya Raman', role: 'Support lead', team: 'Support', initials: 'PR' },
];

const you = (...labels: string[]): Tag[] => labels.map((label) => ({ label, origin: 'user' }));
const ai = (...labels: string[]): Tag[] => labels.map((label) => ({ label, origin: 'ai' }));

// Tags for the three decisions in fixtures.ts, which predate the map.
export const fixtureExtras: Record<string, Pick<Decision, 'ownerId' | 'stakeholderIds' | 'tags'>> = {
  'd-onboarding-checklist': {
    ownerId: ME,
    stakeholderIds: ['tm-maya', 'tm-priya'],
    tags: [...you('onboarding', 'activation'), ...ai('support')],
  },
  'd-pricing-seats': {
    ownerId: ME,
    stakeholderIds: ['tm-rafael', 'tm-dev'],
    tags: [...you('pricing'), ...ai('team plan')],
  },
  'd-mobile-push': {
    ownerId: ME,
    stakeholderIds: ['tm-dev'],
    tags: [...you('notifications', 'roadmap')],
  },
};

interface PastSpec {
  id: string;
  ownerId: string;
  stakeholderIds?: string[];
  tags: Tag[];
  question: string;
  notes: string;
  createdAt: string; // YYYY-MM-DD
  loggedAt: string; // YYYY-MM-DD
  reviewDate: string;
  summary: string;
  rationale: string;
  chosen: { label: string; summary: string; pros?: string[]; cons?: string[] };
  notTaken: { label: string; summary: string; reason: string; pros?: string[]; cons?: string[] }[];
}

// Builds a logged decision and its options from a compact spec.
function past(spec: PastSpec): { decision: Decision; options: OptionNode[] } {
  const chosenId = `o-${spec.id.slice(2)}-0`;
  const option = (
    o: { label: string; summary: string; pros?: string[]; cons?: string[] },
    i: number,
    score: number,
  ): OptionNode => ({
    id: `o-${spec.id.slice(2)}-${i}`,
    decisionId: spec.id,
    parentId: null,
    label: o.label,
    summary: o.summary,
    pros: o.pros ?? [],
    cons: o.cons ?? [],
    score,
    contextIds: [],
    state: 'open',
  });
  return {
    decision: {
      id: spec.id,
      question: spec.question,
      notes: spec.notes,
      links: [],
      constraints: [],
      reviewDate: spec.reviewDate,
      status: 'decided',
      createdAt: `${spec.createdAt}T17:00:00.000Z`,
      ownerId: spec.ownerId,
      stakeholderIds: spec.stakeholderIds ?? [],
      tags: spec.tags,
      chosenOptionId: chosenId,
      summary: spec.summary,
      rationale: spec.rationale,
      loggedAt: `${spec.loggedAt}T18:00:00.000Z`,
    },
    options: [
      { ...option(spec.chosen, 0, 74), state: 'chosen' },
      ...spec.notTaken.map((o, i) => ({
        ...option(o, i + 1, 58 - i * 6),
        state: 'pruned' as const,
        pruneReason: o.reason,
      })),
    ],
  };
}

const specs: PastSpec[] = [
  {
    id: 'd-activation-metric',
    ownerId: ME,
    stakeholderIds: ['tm-ines', 'tm-rafael'],
    tags: [...you('activation', 'metrics')],
    question: 'Which activation metric should Growth report on?',
    notes: 'Board wants one number. Today we report signups, which don’t predict retention.',
    createdAt: '2026-06-08',
    loggedAt: '2026-06-15',
    reviewDate: '2026-08-15',
    summary: 'Activation = 3+ teammates invited and one board shared in 7 days.',
    rationale: 'Ines’s cohort cut showed invited teams retain at almost twice the rate of solo workspaces.',
    chosen: { label: '3+ invites and a shared board in 7 days', summary: 'Team behaviour, measured in week one.' },
    notTaken: [
      {
        label: 'First board created',
        summary: 'Easy to hit, easy to measure.',
        reason: '72% hit it, so it doesn’t separate teams that stay from teams that leave.',
      },
    ],
  },
  {
    id: 'd-support-hours',
    ownerId: 'tm-priya',
    stakeholderIds: ['tm-rafael'],
    tags: [...you('support'), ...ai('international')],
    question: 'Extend support hours to cover APAC customers?',
    notes: '14% of tickets now arrive between 10pm and 6am Pacific.',
    createdAt: '2026-06-22',
    loggedAt: '2026-06-30',
    reviewDate: '2026-08-30',
    summary: 'Async-first support with a 12-hour response target; no night shift.',
    rationale: 'Most overnight tickets are how-to questions that the help center can answer by morning.',
    chosen: { label: 'Async with a 12h target', summary: 'Better macros and a clear response promise.' },
    notTaken: [
      {
        label: 'Hire an APAC support rep',
        summary: 'Live coverage during APAC hours.',
        reason: 'Ticket volume doesn’t justify a full hire yet; revisit at 25% overnight share.',
      },
    ],
  },
  {
    id: 'd-notification-service',
    ownerId: 'tm-dev',
    stakeholderIds: ['tm-theo', ME],
    tags: [...you('infra', 'notifications')],
    question: 'Build our own notification service or buy one?',
    notes: 'Email, in-app and Slack notifications each have their own code path today.',
    createdAt: '2026-07-06',
    loggedAt: '2026-07-14',
    reviewDate: '2026-09-30',
    summary: 'Build one service on the existing job queue.',
    rationale: 'Vendor pricing scales per message and our digest plans would make it the third-largest bill.',
    chosen: { label: 'Build on the job queue', summary: 'One service, every channel.' },
    notTaken: [
      {
        label: 'Buy a notification vendor',
        summary: 'Faster to start.',
        reason: 'Per-message pricing gets expensive once digests ship.',
      },
    ],
  },
  {
    id: 'd-analytics-db',
    ownerId: 'tm-dev',
    tags: [...you('infra'), ...ai('performance')],
    question: 'Move analytics events to a separate database now?',
    notes: 'Dashboard queries slow down every Monday when weekly reports run.',
    createdAt: '2026-07-20',
    loggedAt: '2026-07-24',
    reviewDate: '2026-09-24',
    summary: 'Add a read replica first; split the database only if that isn’t enough.',
    rationale: 'A replica takes days, the split takes a quarter, and we aren’t sure the split is needed.',
    chosen: { label: 'Read replica first', summary: 'Point reports at a replica.' },
    notTaken: [
      {
        label: 'Separate analytics database',
        summary: 'Clean split now.',
        reason: 'A quarter of platform time for a problem a replica might solve.',
      },
    ],
  },
  {
    id: 'd-help-center',
    ownerId: 'tm-priya',
    stakeholderIds: ['tm-maya'],
    tags: [...you('support'), ...ai('onboarding')],
    question: 'Rebuild the help center in the product or keep the external site?',
    notes: 'Help center traffic is mostly new admins in their first week.',
    createdAt: '2026-08-03',
    loggedAt: '2026-08-11',
    reviewDate: '2026-11-11',
    summary: 'Add an in-product help panel that pulls from the existing site.',
    rationale: 'Meets new admins where they get stuck without migrating 200 articles.',
    chosen: { label: 'In-product help panel', summary: 'Contextual help, same articles.' },
    notTaken: [
      {
        label: 'Full in-product rebuild',
        summary: 'One place for everything.',
        reason: 'Migrating every article is a quarter of work for little extra benefit.',
      },
    ],
  },
  {
    id: 'd-dashboard-timing',
    ownerId: 'tm-maya',
    stakeholderIds: ['tm-theo', ME],
    tags: [...you('design', 'roadmap')],
    question: 'Ship the dashboard redesign this quarter or next?',
    notes: 'Redesign v2 is ready for review; the onboarding checklist also touches the left rail.',
    createdAt: '2026-08-24',
    loggedAt: '2026-08-31',
    reviewDate: '2026-12-15',
    summary: 'Ship next quarter, after the onboarding checklist settles.',
    rationale: 'Shipping both in the same weeks would muddy the activation read on the checklist.',
    chosen: { label: 'Next quarter', summary: 'Let the checklist results land first.' },
    notTaken: [
      {
        label: 'This quarter',
        summary: 'Faster dashboard and fewer widgets now.',
        reason: 'Both touch the left rail; we couldn’t tell which one moved activation.',
      },
    ],
  },
  {
    id: 'd-checklist-copy',
    ownerId: 'tm-maya',
    stakeholderIds: [ME],
    tags: [...you('onboarding', 'design')],
    question: 'Should the checklist copy be task-based or benefit-based?',
    notes: 'Step 4 (connect an integration) confuses new admins.',
    createdAt: '2026-09-04',
    loggedAt: '2026-09-09',
    reviewDate: '2026-10-20',
    summary: 'Task-based copy, with one line on why each step matters.',
    rationale: 'Admins scan for the next thing to do; benefits read as marketing.',
    chosen: { label: 'Task-based copy', summary: '“Invite 3 teammates” plus a one-line why.' },
    notTaken: [
      {
        label: 'Benefit-based copy',
        summary: '“Get your team on the same page.”',
        reason: 'In testing, admins skipped steps they couldn’t picture doing.',
      },
    ],
  },
  {
    id: 'd-q4-bet',
    ownerId: 'tm-rafael',
    stakeholderIds: [ME, 'tm-theo'],
    tags: [...you('roadmap', 'retention')],
    question: 'What is the one bet for Q4?',
    notes: 'Too many half-started projects in Q3.',
    createdAt: '2026-09-14',
    loggedAt: '2026-09-16',
    reviewDate: '2027-01-10',
    summary: 'Week-4 retention. Anything that doesn’t move activation or retention waits.',
    rationale: 'Retention compounds; new features don’t help if teams leave in month two.',
    chosen: { label: 'Week-4 retention', summary: 'Focus every team on keeping new workspaces.' },
    notTaken: [
      {
        label: 'Enterprise readiness',
        summary: 'SSO, audit logs, admin controls.',
        reason: 'Two deals don’t outweigh the month-two churn we see across Starter.',
      },
    ],
  },
  {
    id: 'd-annual-discount',
    ownerId: 'tm-rafael',
    stakeholderIds: [ME, 'tm-ines'],
    tags: [...you('pricing'), ...ai('team plan')],
    question: 'Offer an annual discount on the Team plan?',
    notes: 'Showing the annual price first moved annual mix from 22% to 29%.',
    createdAt: '2026-09-28',
    loggedAt: '2026-10-02',
    reviewDate: '2026-12-31',
    summary: 'Two months free on annual Team plans.',
    rationale: 'Annual customers churn far less, and the pricing page test showed demand without a deeper cut.',
    chosen: { label: 'Two months free on annual', summary: 'Simple to explain.' },
    notTaken: [
      {
        label: 'No annual discount',
        summary: 'Keep pricing simple.',
        reason: 'Leaves retention on the table when annual customers barely churn.',
      },
    ],
  },
  {
    id: 'd-api-limits',
    ownerId: 'tm-dev',
    stakeholderIds: ['tm-theo'],
    tags: [...you('infra'), ...ai('enterprise')],
    question: 'Raise API rate limits for Team plan workspaces?',
    notes: 'Two agencies hit the 120 requests per minute limit syncing boards.',
    createdAt: '2026-10-05',
    loggedAt: '2026-10-08',
    reviewDate: '2026-12-08',
    summary: 'Raise to 600 per minute with per-key caps.',
    rationale: 'Read replica gave us headroom; per-key caps stop one integration from starving others.',
    chosen: { label: '600/min with per-key caps', summary: 'More room, still fair.' },
    notTaken: [
      {
        label: 'Keep 120/min',
        summary: 'No change.',
        reason: 'Agencies are the segment most likely to upgrade, and they’re the ones hitting it.',
      },
    ],
  },
  {
    id: 'd-digest-cadence',
    ownerId: ME,
    stakeholderIds: ['tm-ines'],
    tags: [...you('notifications', 'retention')],
    question: 'Should the email digest be daily or weekly by default?',
    notes: 'Weekly digest is live for 20% of workspaces: 18% open rate.',
    createdAt: '2026-10-06',
    loggedAt: '2026-10-09',
    reviewDate: '2026-10-30',
    summary: 'Weekly by default; daily as an opt-in.',
    rationale: 'Weekly already brings 6% of opens back the same day, and support hears complaints about email noise.',
    chosen: { label: 'Weekly by default', summary: 'Opt in to daily.' },
    notTaken: [
      {
        label: 'Daily by default',
        summary: 'More touches.',
        reason: 'Support tickets show email noise already makes clients unsubscribe from everything.',
      },
    ],
  },
  {
    id: 'd-sso-plan',
    ownerId: 'tm-theo',
    stakeholderIds: ['tm-rafael', 'tm-dev', ME],
    tags: [...you('enterprise', 'pricing'), ...ai('security')],
    question: 'Include SSO in the Team plan or keep it Enterprise-only?',
    notes: 'Two Team accounts around 80 seats would upgrade to Enterprise only with SSO.',
    createdAt: '2026-10-12',
    loggedAt: '2026-10-16',
    reviewDate: '2027-01-16',
    summary: 'Keep SSO Enterprise-only and start the build in January.',
    rationale: 'Three sprints of SSO would pause the notification migration that Q4 retention work depends on.',
    chosen: { label: 'Enterprise-only, build in January', summary: 'Protect the Q4 bet.' },
    notTaken: [
      {
        label: 'Add SSO to Team now',
        summary: 'Unblock the two accounts.',
        reason: 'Pauses the notification migration for a quarter.',
      },
    ],
  },
  {
    id: 'd-referrals-timing',
    ownerId: ME,
    stakeholderIds: ['tm-maya', 'tm-rafael'],
    tags: [...you('growth', 'roadmap'), ...ai('referrals')],
    question: 'Build in-app referrals before or after the dashboard redesign?',
    notes: 'Invites drive 27% of new workspaces. Customers keep asking for referral credit.',
    createdAt: '2026-10-19',
    loggedAt: '2026-10-23',
    reviewDate: '2026-11-25',
    summary: 'Before, as a lightweight version using coupon codes capped at 3 per workspace.',
    rationale: 'Coupon codes reuse billing, so it ships in two weeks and doesn’t touch the dashboard.',
    chosen: { label: 'Lightweight version first', summary: 'Coupon codes, capped at 3.' },
    notTaken: [
      {
        label: 'After the redesign',
        summary: 'Build it into the new dashboard.',
        reason: 'Pushes a proven invite channel into next year.',
      },
    ],
  },
];

const built = specs.map(past);
export const historyDecisions: Decision[] = built.map((b) => b.decision);
export const historyOptions: OptionNode[] = built.flatMap((b) => b.options);

// Two decisions still being worked on: one of yours, one of a teammate's.
export const openDecisions: Decision[] = [
  {
    id: 'd-trial-card',
    question: 'Should Team trials ask for a credit card up front?',
    notes: 'Trial-to-paid is 11.4%. Card-up-front trials convert higher but start far less often.',
    links: [],
    constraints: ['Billing can’t do mid-cycle proration yet'],
    deadline: '2026-11-07',
    reviewDate: '2026-12-15',
    status: 'brief',
    createdAt: '2026-10-27T17:00:00.000Z',
    ownerId: ME,
    stakeholderIds: ['tm-ines'],
    tags: [...you('trials', 'pricing')],
  },
  {
    id: 'd-exit-survey',
    question: 'Add a required exit survey to the cancel flow?',
    notes: 'Cancellation survey is optional; 1 in 5 cancellations answer it.',
    links: [],
    constraints: [],
    deadline: '2026-11-14',
    status: 'framing',
    createdAt: '2026-10-29T17:00:00.000Z',
    ownerId: 'tm-priya',
    stakeholderIds: [ME],
    tags: [...you('churn'), ...ai('support')],
  },
];

const link = (
  fromId: string,
  toId: string,
  origin: DecisionLink['origin'],
  status: DecisionLink['status'],
  reason?: string,
): DecisionLink => ({
  id: `l-${fromId.slice(2)}--${toId.slice(2)}`,
  fromId,
  toId,
  kind: origin === 'user' ? 'builds-on' : 'related',
  origin,
  status,
  reason,
});

export const seedLinks: DecisionLink[] = [
  link('d-activation-metric', 'd-onboarding-checklist', 'user', 'accepted'),
  link('d-onboarding-checklist', 'd-checklist-copy', 'user', 'accepted'),
  link('d-onboarding-checklist', 'd-dashboard-timing', 'user', 'accepted'),
  link('d-dashboard-timing', 'd-referrals-timing', 'user', 'accepted'),
  link('d-notification-service', 'd-mobile-push', 'user', 'accepted'),
  link('d-mobile-push', 'd-digest-cadence', 'user', 'accepted'),
  link('d-pricing-seats', 'd-annual-discount', 'user', 'accepted'),
  link('d-q4-bet', 'd-sso-plan', 'user', 'accepted'),
  link('d-analytics-db', 'd-api-limits', 'user', 'accepted'),
  link('d-pricing-seats', 'd-trial-card', 'user', 'accepted'),
  link(
    'd-q4-bet',
    'd-referrals-timing',
    'ai',
    'accepted',
    'Both cite week-4 retention as the reason to act now.',
  ),
  link(
    'd-help-center',
    'd-onboarding-checklist',
    'ai',
    'suggested',
    'Both target new admins in their first week, and #customer-feedback mentions them together.',
  ),
  link(
    'd-pricing-seats',
    'd-sso-plan',
    'ai',
    'suggested',
    'The SSO call changes what the Team plan includes, which the per-workspace price was based on.',
  ),
  link(
    'd-api-limits',
    'd-sso-plan',
    'ai',
    'suggested',
    'Both are Enterprise asks from the same accounts.',
  ),
];

export const seedOutcomes: Outcome[] = [
  {
    id: 'out-activation-metric',
    decisionId: 'd-activation-metric',
    result: 'worked',
    summary: 'The board adopted it; it predicts week-4 retention well.',
    metrics: 'Activation 31% (Aug) → 38% (Sep)',
    loggedAt: '2026-08-16T18:00:00.000Z',
  },
  {
    id: 'out-support-hours',
    decisionId: 'd-support-hours',
    result: 'worked',
    summary: 'APAC satisfaction held steady without a night shift.',
    metrics: 'CSAT 92% → 91%; median first reply 9h',
    loggedAt: '2026-09-01T18:00:00.000Z',
  },
  {
    id: 'out-notification-service',
    decisionId: 'd-notification-service',
    result: 'mixed',
    summary: 'The migration is 60% done; email and in-app moved, Slack DMs haven’t.',
    metrics: 'New channel setup: a sprint → a few days',
    loggedAt: '2026-10-01T18:00:00.000Z',
  },
  {
    id: 'out-analytics-db',
    decisionId: 'd-analytics-db',
    result: 'worked',
    summary: 'Monday slowdowns are gone.',
    metrics: 'Dashboard p75 3.4s → 1.9s on Mondays',
    loggedAt: '2026-09-25T18:00:00.000Z',
  },
];

export const seedSuggestions: SuggestedDecision[] = [
  {
    id: 'sg-checklist-sync',
    question: 'Move onboarding checklist progress to the server?',
    why: 'Checklist progress resets on a new device, and admins who finish the checklist retain at 47%.',
    evidence: [
      {
        sourceLabel: '#eng-platform',
        author: 'Lena (Frontend engineer)',
        snippet: 'The onboarding checklist state lives in localStorage right now, so it resets on a new device.',
      },
      {
        sourceLabel: '#growth',
        author: 'Ines (Growth analyst)',
        snippet: 'Workspaces that finished the checklist retain at 47%.',
      },
    ],
    suggestedAt: '2026-10-30T15:00:00.000Z',
    status: 'new',
  },
  {
    id: 'sg-guest-mentions',
    question: 'Let admins turn off @mention emails for guests?',
    why: 'Support logged four tickets in a week, and it overlaps with your digest decision.',
    evidence: [
      {
        sourceLabel: '#customer-feedback',
        author: 'Priya (Support)',
        snippet: 'Four tickets this week from admins asking to turn off @mention emails for guests.',
      },
    ],
    suggestedAt: '2026-10-29T15:00:00.000Z',
    status: 'new',
  },
  {
    id: 'sg-trial-copy',
    question: 'Change the day-12 trial reminder copy?',
    why: 'Trial users ask whether their boards survive the trial; it ties into your credit-card trial decision.',
    evidence: [
      {
        sourceLabel: '#customer-feedback',
        author: 'Owen (Customer success)',
        snippet: 'Trial users keep asking whether their boards survive if the trial ends.',
      },
    ],
    suggestedAt: '2026-10-28T15:00:00.000Z',
    status: 'new',
  },
];
