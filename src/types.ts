// Core data objects, named after docs/product/features.md §6.
// Everything in the prototype is fake data held in the client store.

export type Provider = 'google' | 'slack';

export interface User {
  id: string;
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
}

export type DecisionStatus = 'framing' | 'brief' | 'options' | 'decided';

// Where a decision sits on the causal map. Most decisions derive this from their
// status, but the demo's planted "future directions" are marked explicitly.
export type Horizon = 'past' | 'now' | 'future';

// F-16: what actually happened after the call, recorded on the review date.
export interface Outcome {
  result: string; // what happened, in the PM's words
  metrics?: string; // the numbers that moved
  loggedAt: string;
}

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
  // Set when the decision is logged (F-14).
  chosenOptionId?: string;
  summary?: string;
  rationale?: string;
  loggedAt?: string;
  // F-16: the recorded result, once the review date comes around.
  outcome?: Outcome;
  // The decisions this one built on — the roots of the causal map. Ids point at
  // earlier decisions; the map draws an edge from each to this one.
  builtOn?: string[];
  // A short goal label shown on the map node, e.g. "Activation" or "Expansion".
  metric?: string;
  // Demo only: a planted direction the PM can explore but hasn't committed to.
  // Rendered as a dashed, speculative node the user can step into.
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
}

export interface WrongAnswerReport {
  id: string;
  surface: 'brief' | 'gap' | 'option' | 'record' | 'other';
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
  // True when the workspace is loaded with the planted demo forest, so the UI
  // can label it honestly as a demonstration rather than the PM's own data.
  demo: boolean;
}
