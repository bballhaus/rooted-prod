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

export interface OptionNode {
  id: string;
  decisionId: string;
  parentId: string | null;
  label: string;
  summary: string;
  pros: string[];
  cons: string[];
  score: number; // rough 0–100
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
}
