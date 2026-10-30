// Synthetic Slack messages and Google Drive snippets for the evidence brief
// (F-06). Every person, message and number here is made up for the Fernwave
// demo; real Slack data never goes into fixtures (AGENTS.md).

export type Theme =
  | 'onboarding'
  | 'activation'
  | 'pricing'
  | 'trials'
  | 'notifications'
  | 'churn'
  | 'sso'
  | 'referrals'
  | 'dashboard';

// The group label the brief shows for each theme.
export const THEME_LABELS: Record<Theme, string> = {
  onboarding: 'Onboarding',
  activation: 'Activation',
  pricing: 'Pricing and packaging',
  trials: 'Trials and conversion',
  notifications: 'Notifications',
  churn: 'Churn and retention',
  sso: 'SSO and security',
  referrals: 'Referrals',
  dashboard: 'Dashboard redesign',
};

export interface CorpusMessage {
  id: string;
  channelId: string; // matches a channel id in the Slack source
  author: string; // invented first name + role
  date: string; // ISO date
  text: string;
  theme: Theme;
  keywords: string[];
}

export interface DriveSnippet {
  id: string;
  folderId: string; // matches a folder id in the Drive source
  title: string;
  author: string;
  date: string;
  text: string;
  theme: Theme;
  keywords: string[];
}

export const slackCorpus: CorpusMessage[] = [
  // #product
  {
    id: 'm-01',
    channelId: 'ch-product',
    author: 'Maya (Design lead)',
    date: '2026-10-21',
    text: 'Dashboard redesign v2 is ready for review. We cut the default widgets from 9 to 4 and moved "Invite teammates" above the fold.',
    theme: 'dashboard',
    keywords: ['dashboard', 'redesign', 'widgets', 'home', 'layout', 'invite'],
  },
  {
    id: 'm-02',
    channelId: 'ch-product',
    author: 'Theo (PM, Core)',
    date: '2026-10-16',
    text: 'Heads up: the onboarding checklist and the dashboard redesign both touch the left rail. Let\'s not ship them in the same week.',
    theme: 'dashboard',
    keywords: ['dashboard', 'redesign', 'onboarding', 'checklist', 'sidebar', 'ship', 'launch'],
  },
  {
    id: 'm-03',
    channelId: 'ch-product',
    author: 'Maya (Design lead)',
    date: '2026-10-09',
    text: 'Usability round 3: 5 of 6 admins found SSO settings only after we pointed them to Workspace → Security.',
    theme: 'sso',
    keywords: ['sso', 'saml', 'security', 'admin', 'settings', 'usability'],
  },
  {
    id: 'm-04',
    channelId: 'ch-product',
    author: 'Theo (PM, Core)',
    date: '2026-09-30',
    text: 'Proposal: move the notification preferences into one page. Today there are three places to mute things and support tickets show people can\'t find any of them.',
    theme: 'notifications',
    keywords: ['notification', 'notifications', 'preferences', 'email', 'digest', 'mute'],
  },
  {
    id: 'm-05',
    channelId: 'ch-product',
    author: 'Rafael (Head of product)',
    date: '2026-10-23',
    text: 'Q4 bet for Growth is week-4 retention. Anything that doesn\'t move activation or retention waits until January.',
    theme: 'churn',
    keywords: ['retention', 'churn', 'activation', 'roadmap', 'priority', 'growth'],
  },
  {
    id: 'm-06',
    channelId: 'ch-product',
    author: 'Rafael (Head of product)',
    date: '2026-10-06',
    text: 'Referral program is on the table for Q1. I want to see what share of new workspaces already come from an invite before we build credits.',
    theme: 'referrals',
    keywords: ['referral', 'referrals', 'invite', 'credits', 'viral', 'program'],
  },

  // #growth
  {
    id: 'm-07',
    channelId: 'ch-growth',
    author: 'Ines (Growth analyst)',
    date: '2026-10-20',
    text: 'Activation (3+ teammates invited and one board shared in 7 days) is 38% for the September cohort, up from 31% in August. The checklist looks like most of the lift.',
    theme: 'activation',
    keywords: ['activation', 'activate', 'cohort', 'checklist', 'onboarding', 'invite', 'metric'],
  },
  {
    id: 'm-08',
    channelId: 'ch-growth',
    author: 'Ines (Growth analyst)',
    date: '2026-10-14',
    text: 'Trial-to-paid is 11.4% on the 14-day trial. Workspaces that invite 3+ people convert at 24%; solo trials at 4%.',
    theme: 'trials',
    keywords: ['trial', 'trials', 'conversion', 'convert', 'paid', 'invite', 'pricing'],
  },
  {
    id: 'm-09',
    channelId: 'ch-growth',
    author: 'Sam (Growth engineer)',
    date: '2026-10-12',
    text: 'If we test a 30-day trial, I can ship it behind a flag in 2 days. Billing needs a heads up because invoices key off trial end.',
    theme: 'trials',
    keywords: ['trial', 'trials', 'length', 'experiment', 'billing', 'flag', 'test'],
  },
  {
    id: 'm-10',
    channelId: 'ch-growth',
    author: 'Ines (Growth analyst)',
    date: '2026-10-02',
    text: 'Invites from existing users drive 27% of new workspaces. Invite → signup rate is 41%, but only 9% of invitees invite someone else.',
    theme: 'referrals',
    keywords: ['referral', 'referrals', 'invite', 'invites', 'viral', 'signup', 'acquisition'],
  },
  {
    id: 'm-11',
    channelId: 'ch-growth',
    author: 'Sam (Growth engineer)',
    date: '2026-09-25',
    text: 'Weekly digest email is live for 20% of workspaces. Early read: 18% open rate, and 6% of opens come back to the app the same day.',
    theme: 'notifications',
    keywords: ['notification', 'notifications', 'email', 'digest', 'engagement', 'retention'],
  },
  {
    id: 'm-12',
    channelId: 'ch-growth',
    author: 'Ines (Growth analyst)',
    date: '2026-10-22',
    text: 'Logo churn on Starter is 6.1% monthly; Team is 2.3%. Most Starter churn happens in month 2, after the first project wraps up.',
    theme: 'churn',
    keywords: ['churn', 'retention', 'cancel', 'starter', 'team', 'plan', 'pricing'],
  },
  {
    id: 'm-13',
    channelId: 'ch-growth',
    author: 'Sam (Growth engineer)',
    date: '2026-10-07',
    text: 'Pricing page test: showing annual price first moved annual mix from 22% to 29% with no drop in checkout starts.',
    theme: 'pricing',
    keywords: ['pricing', 'price', 'annual', 'checkout', 'plan', 'packaging', 'experiment'],
  },
  {
    id: 'm-14',
    channelId: 'ch-growth',
    author: 'Ines (Growth analyst)',
    date: '2026-09-18',
    text: 'Onboarding funnel: 72% create a board, 46% invite someone, 31% finish setup. Biggest drop is between "create board" and "invite".',
    theme: 'onboarding',
    keywords: ['onboarding', 'funnel', 'setup', 'invite', 'activation', 'board'],
  },

  // #eng-platform
  {
    id: 'm-15',
    channelId: 'ch-eng',
    author: 'Dev (Staff engineer)',
    date: '2026-10-19',
    text: 'SAML SSO estimate: about 3 sprints for Okta and Azure AD, plus SCIM later. We\'d need to pause the notification service migration.',
    theme: 'sso',
    keywords: ['sso', 'saml', 'okta', 'scim', 'enterprise', 'security', 'estimate'],
  },
  {
    id: 'm-16',
    channelId: 'ch-eng',
    author: 'Dev (Staff engineer)',
    date: '2026-10-05',
    text: 'Notification service migration is 60% done. Once it lands, adding a new channel (push, Slack DMs) is a few days instead of a sprint.',
    theme: 'notifications',
    keywords: ['notification', 'notifications', 'push', 'service', 'migration', 'slack'],
  },
  {
    id: 'm-17',
    channelId: 'ch-eng',
    author: 'Lena (Frontend engineer)',
    date: '2026-10-15',
    text: 'New dashboard loads in 1.9s p75 vs 3.4s today. The widget API is the slow part; dropping to 4 widgets is most of the win.',
    theme: 'dashboard',
    keywords: ['dashboard', 'redesign', 'performance', 'widgets', 'load', 'speed'],
  },
  {
    id: 'm-18',
    channelId: 'ch-eng',
    author: 'Dev (Staff engineer)',
    date: '2026-09-28',
    text: 'Billing service can\'t do per-seat proration mid-cycle yet. Any pricing change that needs it adds about 2 sprints.',
    theme: 'pricing',
    keywords: ['pricing', 'price', 'billing', 'seat', 'seats', 'proration', 'plan'],
  },
  {
    id: 'm-19',
    channelId: 'ch-eng',
    author: 'Lena (Frontend engineer)',
    date: '2026-10-10',
    text: 'The onboarding checklist state lives in localStorage right now, so it resets on a new device. Moving it server-side is about 3 days.',
    theme: 'onboarding',
    keywords: ['onboarding', 'checklist', 'setup', 'device', 'bug'],
  },
  {
    id: 'm-20',
    channelId: 'ch-eng',
    author: 'Sam (Growth engineer)',
    date: '2026-10-18',
    text: 'Referral credit ledger would be new infra. Cheaper option: reuse coupon codes in billing and cap at 3 per workspace.',
    theme: 'referrals',
    keywords: ['referral', 'referrals', 'credits', 'coupon', 'billing', 'invite'],
  },

  // #customer-feedback
  {
    id: 'm-21',
    channelId: 'ch-support',
    author: 'Priya (Support)',
    date: '2026-10-17',
    text: 'Four tickets this week from admins asking to turn off @mention emails for guests. They say the noise makes their clients unsubscribe from everything.',
    theme: 'notifications',
    keywords: ['notification', 'notifications', 'email', 'mention', 'guests', 'noise', 'churn'],
  },
  {
    id: 'm-22',
    channelId: 'ch-support',
    author: 'Priya (Support)',
    date: '2026-10-13',
    text: 'Two Team-plan accounts said they\'d upgrade to Enterprise only if we have SSO. Both are around 80 seats.',
    theme: 'sso',
    keywords: ['sso', 'saml', 'enterprise', 'upgrade', 'security', 'seats'],
  },
  {
    id: 'm-23',
    channelId: 'ch-support',
    author: 'Owen (Customer success)',
    date: '2026-10-21',
    text: 'Cancellation survey, last 30 days: 38% "project ended", 24% "too expensive for a small team", 15% "teammates didn\'t adopt it".',
    theme: 'churn',
    keywords: ['churn', 'cancel', 'cancellation', 'retention', 'pricing', 'price', 'survey'],
  },
  {
    id: 'm-24',
    channelId: 'ch-support',
    author: 'Owen (Customer success)',
    date: '2026-10-08',
    text: 'Trial users keep asking whether their boards survive if the trial ends. Clearer copy on day 12 might save some of the drop-off.',
    theme: 'trials',
    keywords: ['trial', 'trials', 'conversion', 'expire', 'copy', 'email'],
  },
  {
    id: 'm-25',
    channelId: 'ch-support',
    author: 'Priya (Support)',
    date: '2026-09-29',
    text: 'Beta feedback on the new dashboard: people like the cleaner layout but miss the "Recent boards" widget. 7 of 19 comments mention it.',
    theme: 'dashboard',
    keywords: ['dashboard', 'redesign', 'widgets', 'feedback', 'beta', 'layout'],
  },
  {
    id: 'm-26',
    channelId: 'ch-support',
    author: 'Owen (Customer success)',
    date: '2026-10-03',
    text: 'New admins still ask "what do I do after inviting people?" The checklist helped but step 4 (connect an integration) confuses them.',
    theme: 'onboarding',
    keywords: ['onboarding', 'checklist', 'setup', 'admin', 'integration', 'activation'],
  },
  {
    id: 'm-27',
    channelId: 'ch-support',
    author: 'Priya (Support)',
    date: '2026-10-24',
    text: 'A customer asked if they could get a free month for referring another agency. Third time someone has asked this quarter.',
    theme: 'referrals',
    keywords: ['referral', 'referrals', 'credits', 'free', 'agency', 'invite'],
  },

  // #sales (blocked by default: the agent must never read these unless allowed)
  {
    id: 'm-28',
    channelId: 'ch-sales',
    author: 'Marcus (Account executive)',
    date: '2026-10-20',
    text: 'Lost the Brightline deal on price again. They wanted workspace pricing with no seat cap.',
    theme: 'pricing',
    keywords: ['pricing', 'price', 'seat', 'seats', 'deal', 'plan', 'packaging'],
  },
  {
    id: 'm-29',
    channelId: 'ch-sales',
    author: 'Marcus (Account executive)',
    date: '2026-10-11',
    text: 'SSO came up on four enterprise calls this month. Two said it\'s a hard requirement from their security team.',
    theme: 'sso',
    keywords: ['sso', 'saml', 'enterprise', 'security', 'deal'],
  },
  {
    id: 'm-30',
    channelId: 'ch-sales',
    author: 'Aisha (Sales lead)',
    date: '2026-10-01',
    text: 'Prospects on the 14-day trial ask for an extension about half the time. A 30-day option would make my pipeline easier to manage.',
    theme: 'trials',
    keywords: ['trial', 'trials', 'length', 'extension', 'conversion', 'pipeline'],
  },

  // #leadership (blocked by default)
  {
    id: 'm-31',
    channelId: 'ch-leadership',
    author: 'Hana (CEO)',
    date: '2026-10-15',
    text: 'Board wants net revenue retention above 105% by Q2. Retention and expansion over new logos for the next two quarters.',
    theme: 'churn',
    keywords: ['retention', 'churn', 'revenue', 'expansion', 'pricing', 'board'],
  },
  {
    id: 'm-32',
    channelId: 'ch-leadership',
    author: 'Carlos (CFO)',
    date: '2026-10-09',
    text: 'Any pricing change needs a finance review of the annual contracts first. Don\'t announce anything before December.',
    theme: 'pricing',
    keywords: ['pricing', 'price', 'finance', 'annual', 'contracts', 'plan'],
  },

  // #random (blocked by default)
  {
    id: 'm-33',
    channelId: 'ch-random',
    author: 'Lena (Frontend engineer)',
    date: '2026-10-25',
    text: 'Whoever put the new dashboard mockups on the office TV: the "Recent boards" fans are watching you.',
    theme: 'dashboard',
    keywords: ['dashboard', 'redesign', 'mockups'],
  },
  {
    id: 'm-34',
    channelId: 'ch-random',
    author: 'Sam (Growth engineer)',
    date: '2026-10-04',
    text: 'Onboarding lunch for the three new hires on Thursday. Bring your best "my first week" story.',
    theme: 'onboarding',
    keywords: ['onboarding', 'lunch', 'hires'],
  },

  // A little more in allowed channels so most questions find something.
  {
    id: 'm-35',
    channelId: 'ch-growth',
    author: 'Ines (Growth analyst)',
    date: '2026-10-26',
    text: 'Week-4 retention for the September cohort is 33%, up from 31%. Workspaces that finished the checklist retain at 47%.',
    theme: 'activation',
    keywords: ['retention', 'activation', 'cohort', 'checklist', 'onboarding', 'metric', 'churn'],
  },
  {
    id: 'm-36',
    channelId: 'ch-product',
    author: 'Theo (PM, Core)',
    date: '2026-10-27',
    text: 'Reminder: SSO and audit logs are the two asks blocking the Enterprise tier. Pricing for Enterprise is still "talk to us".',
    theme: 'sso',
    keywords: ['sso', 'enterprise', 'audit', 'pricing', 'security', 'tier'],
  },
];

export const driveCorpus: DriveSnippet[] = [
  {
    id: 'g-01',
    folderId: 'fd-prd',
    title: 'PRD: Onboarding checklist v2',
    author: 'Jordan (PM, Growth)',
    date: '2026-10-11',
    text: 'Goal: lift activation from 38% to 45% by replacing step 4 (connect an integration) with "share your first board".',
    theme: 'onboarding',
    keywords: ['onboarding', 'checklist', 'activation', 'setup', 'board', 'prd'],
  },
  {
    id: 'g-02',
    folderId: 'fd-prd',
    title: 'PRD: Dashboard redesign',
    author: 'Maya (Design lead)',
    date: '2026-09-24',
    text: 'Success metric: weekly active admins who open the dashboard 3+ days a week, from 41% to 50%. Non-goal: custom widgets.',
    theme: 'dashboard',
    keywords: ['dashboard', 'redesign', 'widgets', 'metric', 'prd'],
  },
  {
    id: 'g-03',
    folderId: 'fd-research',
    title: 'Research synthesis: why small teams cancel',
    author: 'Kai (UX researcher)',
    date: '2026-10-02',
    text: '12 interviews. Small agencies use Fernwave per project and cancel between projects; 7 of 12 would keep a cheaper "paused" plan.',
    theme: 'churn',
    keywords: ['churn', 'cancel', 'retention', 'pricing', 'plan', 'pause', 'research'],
  },
  {
    id: 'g-04',
    folderId: 'fd-research',
    title: 'Trial interviews, round 2',
    author: 'Kai (UX researcher)',
    date: '2026-10-19',
    text: 'Solo trialists rarely reach the "aha" moment because Fernwave is built for teams. 9 of 14 said they never invited anyone.',
    theme: 'trials',
    keywords: ['trial', 'trials', 'conversion', 'invite', 'activation', 'research'],
  },
  {
    id: 'g-05',
    folderId: 'fd-finance',
    title: 'FY27 pricing model (finance only)',
    author: 'Carlos (CFO)',
    date: '2026-10-12',
    text: 'Modelled a 10% Team price increase: +$140k ARR if churn holds, break-even if Starter churn rises above 7.5%.',
    theme: 'pricing',
    keywords: ['pricing', 'price', 'finance', 'churn', 'revenue', 'plan'],
  },
];
