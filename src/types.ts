// Core data objects, named after docs/product/features.md §6.
// Everything in the prototype is fake data held in the client store.

// How the PM signed in (decision 0015): an email link, Google or Slack.
export type Provider = 'google' | 'slack' | 'email';

export interface User {
  id: string; // the PM's id inside this workspace (their teammate id)
  authId?: string; // their Supabase Auth user id, once really signed in
  name: string;
  email: string;
  role: string;
  team: string;
  company: string;
  plan: 'beta';
  signInProvider: Provider;
  notificationChannel: 'slack' | 'email';
  defaultReviewDays: 30 | 60 | 90;
}

export interface Channel {
  id: string;
  name: string; // e.g. "#product"
  memberCount: number;
  allowed: boolean; // F-02: the agent may only read allowed channels
}

export interface Source {
  id: string;
  type: 'slack' | 'google-drive';
  name: string;
  connected: boolean;
  connectedAt?: string;
  channels: Channel[]; // for google-drive these are folders
  // Sample content for the demo (0009), read from src/data/slackCorpus.ts.
  // A live source is a real connection, read on the server (0017).
  sample?: boolean;
  unavailable?: boolean; // not offered yet (Google Drive for real workspaces)
}

// Fake teammates, so the map can show who made each call (decision record 0005).
export interface Teammate {
  id: string; // the signed-in PM is a teammate too, with the user's id
  name: string;
  role: string;
  team: string;
  initials: string;
}

// Tags the PM typed and tags the agent suggested look different on purpose.
// An AI tag the PM accepts becomes theirs.
export interface Tag {
  label: string;
  origin: 'user' | 'ai';
}

export type DecisionStatus = 'framing' | 'brief' | 'options' | 'decided';

// Where a decision sits on the map. Most decisions derive this from their
// status, but the demo's planted "directions to explore" are marked explicitly.
export type Horizon = 'past' | 'now' | 'future';

export interface Decision {
  id: string;
  question: string;
  notes: string;
  links: string[];
  constraints: string[];
  deadline?: string; // ISO date
  reviewDate?: string; // ISO date, when to record the outcome
  status: DecisionStatus;
  createdAt: string;
  ownerId?: string; // who made the call; defaults to the signed-in PM
  stakeholderIds?: string[]; // who was consulted
  tags?: Tag[];
  // Set when the decision is logged (F-14).
  chosenOptionId?: string;
  summary?: string;
  rationale?: string;
  loggedAt?: string;
  // A short goal label shown on the map node, e.g. "Activation" (0010).
  metric?: string;
  // Demo only: a planted direction the PM can explore but hasn't committed to.
  // Drawn as a dashed sage node. It's sample data, not an agent suggestion.
  speculative?: boolean;
  horizon?: Horizon;
}

export type ContextOrigin = 'slack' | 'drive' | 'past-decision' | 'user-note';

export interface ContextItem {
  id: string;
  decisionId: string;
  origin: ContextOrigin;
  sourceLabel: string; // "#growth", "Q3 roadmap doc", "Past decision: ..."
  author?: string;
  date: string;
  snippet: string;
  link?: string;
  group: string; // theme the agent grouped it under
  flaggedInaccurate: boolean;
  userEdited: boolean;
  removed: boolean; // removed items stay in the store so the change is traceable
}

export interface Gap {
  id: string;
  decisionId: string;
  question: string; // what the agent couldn't find
  answer?: string; // the PM's answer, if they filled it in
}

export type OptionState = 'open' | 'chosen' | 'pruned';

// Rough 1–5 ratings the agent drafts and the PM can edit. Higher impact and
// evidence are better; lower effort and risk are easier.
export type CriterionKey = 'impact' | 'effort' | 'risk' | 'evidence';
export type Criteria = Partial<Record<CriterionKey, number>>;

export interface OptionNode {
  id: string;
  decisionId: string;
  parentId: string | null; // null for a top-level option; sub-options point at their branch
  label: string;
  summary: string;
  pros: string[];
  cons: string[];
  score: number; // rough 0–100
  criteria?: Criteria;
  contextIds: string[]; // evidence behind the option
  state: OptionState;
  pruneReason?: string; // a rejected option is kept with its reason, never deleted
  linkedDecisionId?: string; // an option that reuses or extends a past decision
}

// A connection between two decisions on the map. The PM's own links are solid;
// links the agent found are dashed until the PM accepts or dismisses them.
export type LinkKind = 'builds-on' | 'related';

export interface DecisionLink {
  id: string;
  fromId: string; // the earlier decision
  toId: string; // the decision that builds on it
  kind: LinkKind;
  origin: 'user' | 'ai';
  status: 'suggested' | 'accepted' | 'dismissed';
  reason?: string; // why the agent thinks they're connected
}

// F-16: what happened after the review date.
export interface Outcome {
  id: string;
  decisionId: string;
  result: 'worked' | 'mixed' | 'did-not-work' | 'too-early';
  summary: string;
  metrics: string;
  loggedAt: string;
}

// A decision the agent thinks the PM will need to make, spotted in context.
export interface SuggestedDecision {
  id: string;
  question: string;
  why: string;
  evidence: { sourceLabel: string; author?: string; snippet: string; link?: string }[];
  suggestedAt: string;
  status: 'new' | 'started' | 'dismissed';
  decisionId?: string; // set once the PM starts it
}

// F-12, F-13: the agent chat. One thread per scope: general, a decision, or
// one option within a decision.
export interface Citation {
  decisionId: string;
  label: string;
}

export interface ChatMessage {
  id: string;
  threadId: string; // 'general', a decision id, or `${decisionId}:${optionId}`
  role: 'user' | 'agent';
  text: string;
  citations?: Citation[];
  // The AI couldn't answer: `text` holds the error message and `retry` the
  // question to ask again. Not part of the conversation sent to Claude.
  failed?: boolean;
  retry?: string;
  failedCode?: string; // which error, so the chat only offers a retry that can work
  edited?: boolean;
  createdAt: string;
}

export interface WrongAnswerReport {
  id: string;
  surface: 'brief' | 'gap' | 'option' | 'record' | 'chat' | 'link' | 'suggestion' | 'tag' | 'other';
  targetId?: string;
  decisionId?: string;
  excerpt?: string; // what the agent said
  note: string; // what the PM says is wrong
  createdAt: string;
}

export interface AppState {
  user: User | null;
  sources: Source[];
  decisions: Decision[];
  contextItems: ContextItem[];
  gaps: Gap[];
  options: OptionNode[];
  reports: WrongAnswerReport[];
  teammates: Teammate[];
  links: DecisionLink[];
  outcomes: Outcome[];
  suggestions: SuggestedDecision[];
  messages: ChatMessage[];
  // True when the planted demo workspace is loaded, so the UI can label it
  // as sample data rather than the PM's own decisions (0009).
  demo: boolean;
  // The PM's own workspace, kept aside while the demo is loaded so leaving the
  // demo brings it back (0009). Never set outside the demo.
  beforeDemo?: Workspace;
  // Whose workspace this browser holds, kept through sign-out, so the same
  // person comes back to it and anyone else starts fresh (0015).
  lastUser?: User;
}

// Everything the PM owns in a workspace, sources included: what the demo
// swaps out and back in.
export type Workspace = Omit<AppState, 'user' | 'demo' | 'beforeDemo' | 'lastUser'>;
