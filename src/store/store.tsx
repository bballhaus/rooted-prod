// One client-side store for the prototype, persisted to localStorage.
// Every feature reads and writes through these actions; add new ones here
// rather than keeping parallel state in a feature.
import { createContext, useContext, useEffect, useMemo, useReducer, type ReactNode } from 'react';
import { demoState } from '../data/demoFixtures';
import { seedState } from '../data/fixtures';
import type {
  AppState,
  ContextItem,
  ChatMessage,
  Decision,
  DecisionLink,
  Gap,
  OptionNode,
  Outcome,
  Provider,
  Source,
  SuggestedDecision,
  User,
  WrongAnswerReport,
} from '../types';
import { demoUser } from '../data/fixtures';
import { driveCorpus, slackCorpus } from '../data/slackCorpus';
import { descendantIds, splitForLog } from './tree';

// v2 added teammates, links, outcomes, suggestions and chat.
export const STORAGE_KEY = 'rooted-demo-v2';

export type Action =
  | { type: 'signIn'; provider: Provider }
  | { type: 'signOut' }
  | { type: 'updateUser'; patch: Partial<User> }
  | { type: 'updateSource'; sourceId: string; patch: Partial<Source> }
  | { type: 'setChannelAllowed'; sourceId: string; channelId: string; allowed: boolean }
  | { type: 'createDecision'; decision: Decision }
  | { type: 'updateDecision'; decisionId: string; patch: Partial<Decision> }
  | { type: 'setBrief'; decisionId: string; items: ContextItem[]; gaps: Gap[] }
  | { type: 'addContextItem'; item: ContextItem }
  | { type: 'updateContextItem'; itemId: string; patch: Partial<ContextItem> }
  | { type: 'updateGap'; gapId: string; patch: Partial<Gap> }
  | { type: 'setOptions'; decisionId: string; options: OptionNode[] }
  | { type: 'addOptions'; options: OptionNode[] }
  | { type: 'updateOption'; optionId: string; patch: Partial<OptionNode> }
  | {
      type: 'logDecision';
      decisionId: string;
      chosenOptionId: string;
      summary: string;
      rationale: string;
      pruned: { optionId: string; reason: string }[];
      loggedAt: string;
    }
  | { type: 'addReport'; report: WrongAnswerReport }
  | { type: 'addLink'; link: DecisionLink }
  | { type: 'updateLink'; linkId: string; patch: Partial<DecisionLink> }
  | { type: 'logOutcome'; outcome: Outcome }
  | { type: 'updateSuggestion'; suggestionId: string; patch: Partial<SuggestedDecision> }
  | { type: 'addMessage'; message: ChatMessage }
  | { type: 'updateMessage'; messageId: string; patch: Partial<ChatMessage> }
  | { type: 'deleteAllData' }
  | { type: 'resetDemo' }
  | { type: 'loadDemo' }
  | { type: 'exitDemo' };

const ORIGIN_OF: Record<Source['type'], ContextItem['origin']> = { slack: 'slack', 'google-drive': 'drive' };

// F-02, F-23: when access is revoked, context already gathered from that
// source (or from one channel or folder) is dropped, not just hidden.
function dropContext(items: ContextItem[], source: Source, channelId?: string): ContextItem[] {
  const origin = ORIGIN_OF[source.type];
  if (!channelId) return items.filter((c) => c.origin !== origin);
  const name = source.channels.find((c) => c.id === channelId)?.name;
  const corpusIds =
    source.type === 'slack'
      ? slackCorpus.filter((m) => m.channelId === channelId).map((m) => m.id)
      : driveCorpus.filter((d) => d.folderId === channelId).map((d) => d.id);
  // Gathered items are keyed `${decisionId}-${corpusId}` (src/agent/brief.ts);
  // Slack items also carry the channel name as their label.
  const fromChannel = (c: ContextItem) =>
    c.sourceLabel === name || corpusIds.some((id) => c.id.endsWith(`-${id}`));
  return items.filter((c) => c.origin !== origin || !fromChannel(c));
}

// F-02, F-23: suggestions quote Slack, so they go with the access to what they quote.
function dropSuggestions(state: AppState, source: Source, channelId?: string): AppState['suggestions'] {
  const labels = source.channels
    .filter((c) => !channelId || c.id === channelId)
    .map((c) => (source.type === 'google-drive' ? `Drive: ${c.name}` : c.name));
  return state.suggestions.filter((s) => !s.evidence.some((e) => labels.includes(e.sourceLabel)));
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'signIn':
      return { ...state, user: { ...(state.user ?? demoUser), signInProvider: action.provider } };
    case 'signOut':
      return { ...state, user: null };
    case 'updateUser':
      return state.user ? { ...state, user: { ...state.user, ...action.patch } } : state;
    case 'updateSource': {
      const source = state.sources.find((s) => s.id === action.sourceId);
      const disconnecting = source?.connected && action.patch.connected === false;
      return {
        ...state,
        sources: state.sources.map((s) => (s.id === action.sourceId ? { ...s, ...action.patch } : s)),
        contextItems: disconnecting ? dropContext(state.contextItems, source) : state.contextItems,
        suggestions: disconnecting ? dropSuggestions(state, source) : state.suggestions,
      };
    }
    case 'setChannelAllowed': {
      const source = state.sources.find((s) => s.id === action.sourceId);
      return {
        ...state,
        contextItems:
          source && !action.allowed
            ? dropContext(state.contextItems, source, action.channelId)
            : state.contextItems,
        suggestions: source && !action.allowed ? dropSuggestions(state, source, action.channelId) : state.suggestions,
        sources: state.sources.map((s) =>
          s.id !== action.sourceId
            ? s
            : {
                ...s,
                channels: s.channels.map((c) =>
                  c.id === action.channelId ? { ...c, allowed: action.allowed } : c,
                ),
              },
        ),
      };
    }
    case 'createDecision':
      return { ...state, decisions: [action.decision, ...state.decisions] };
    case 'updateDecision':
      return {
        ...state,
        decisions: state.decisions.map((d) => (d.id === action.decisionId ? { ...d, ...action.patch } : d)),
      };
    case 'setBrief':
      return {
        ...state,
        contextItems: [
          ...state.contextItems.filter((c) => c.decisionId !== action.decisionId),
          ...action.items,
        ],
        gaps: [...state.gaps.filter((g) => g.decisionId !== action.decisionId), ...action.gaps],
      };
    case 'addContextItem':
      return { ...state, contextItems: [...state.contextItems, action.item] };
    case 'updateContextItem':
      return {
        ...state,
        contextItems: state.contextItems.map((c) => (c.id === action.itemId ? { ...c, ...action.patch } : c)),
      };
    case 'updateGap':
      return { ...state, gaps: state.gaps.map((g) => (g.id === action.gapId ? { ...g, ...action.patch } : g)) };
    case 'setOptions':
      return {
        ...state,
        options: [...state.options.filter((o) => o.decisionId !== action.decisionId), ...action.options],
      };
    case 'addOptions':
      // Append-only, so edits made while the agent was drafting survive.
      return { ...state, options: [...state.options, ...action.options] };
    case 'updateOption':
      return {
        ...state,
        options: state.options.map((o) => (o.id === action.optionId ? { ...o, ...action.patch } : o)),
      };
    case 'logDecision': {
      const reasons = new Map(action.pruned.map((p) => [p.optionId, p.reason]));
      const own = state.options.filter((o) => o.decisionId === action.decisionId);
      const { keep, alternatives } = splitForLog(own, action.chosenOptionId);
      // An option under a branch not taken inherits that branch's reason.
      const inherited = (id: string) => {
        const alt = alternatives.find((a) => a.id === id || descendantIds(own, a.id).has(id));
        return alt && alt.id !== id ? `Under a branch not taken: “${alt.label}”` : '';
      };
      return {
        ...state,
        decisions: state.decisions.map((d) =>
          d.id === action.decisionId
            ? {
                ...d,
                status: 'decided',
                chosenOptionId: action.chosenOptionId,
                summary: action.summary,
                rationale: action.rationale,
                loggedAt: action.loggedAt,
              }
            : d,
        ),
        options: state.options.map((o) => {
          if (o.decisionId !== action.decisionId) return o;
          if (o.id === action.chosenOptionId) return { ...o, state: 'chosen', pruneReason: undefined };
          // Branches above the choice and sub-options below it stay as they are.
          if (keep.has(o.id)) return o.state === 'chosen' ? { ...o, state: 'open' } : o;
          return { ...o, state: 'pruned', pruneReason: reasons.get(o.id) || o.pruneReason || inherited(o.id) };
        }),
      };
    }
    case 'addReport':
      return { ...state, reports: [action.report, ...state.reports] };
    case 'addLink': {
      // One link per pair: linking two decisions again replaces the old link.
      const same = (l: DecisionLink) => l.fromId === action.link.fromId && l.toId === action.link.toId;
      return { ...state, links: [...state.links.filter((l) => !same(l)), action.link] };
    }
    case 'updateLink':
      return { ...state, links: state.links.map((l) => (l.id === action.linkId ? { ...l, ...action.patch } : l)) };
    case 'logOutcome':
      // F-16: one outcome per decision; logging again replaces it.
      return {
        ...state,
        outcomes: [...state.outcomes.filter((o) => o.decisionId !== action.outcome.decisionId), action.outcome],
      };
    case 'updateSuggestion':
      return {
        ...state,
        suggestions: state.suggestions.map((s) => (s.id === action.suggestionId ? { ...s, ...action.patch } : s)),
      };
    case 'addMessage':
      return { ...state, messages: [...state.messages, action.message] };
    case 'updateMessage':
      return {
        ...state,
        messages: state.messages.map((m) => (m.id === action.messageId ? { ...m, ...action.patch } : m)),
      };
    case 'deleteAllData':
      // F-23: wipes decisions, context, links, outcomes, chat and reports and
      // disconnects every source. Teammates belong to the workspace and stay.
      return {
        ...state,
        decisions: [],
        contextItems: [],
        gaps: [],
        options: [],
        reports: [],
        links: [],
        outcomes: [],
        suggestions: [],
        messages: [],
        sources: state.sources.map((s) => ({ ...s, connected: false, connectedAt: undefined })),
      };
    case 'resetDemo':
      return { ...seedState(), user: state.user };
    case 'loadDemo':
      // Swap in the planted demo workspace (0009). Keeps the signed-in user so
      // the demo feels like their own workspace.
      return { ...demoState(), user: state.user };
    case 'exitDemo':
      return { ...seedState(), user: state.user };
  }
}

function load(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    // Fill in anything an older save is missing, so new fields never crash the demo.
    if (raw) return { ...seedState(), ...(JSON.parse(raw) as Partial<AppState>) };
  } catch {
    // fall through to the seed
  }
  return seedState();
}

interface StoreValue {
  state: AppState;
  dispatch: React.Dispatch<Action>;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children, initialState }: { children: ReactNode; initialState?: AppState }) {
  const [state, dispatch] = useReducer(reducer, initialState, (init) => init ?? load());
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // storage can be unavailable; the demo still works in memory
    }
  }, [state]);
  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside <StoreProvider>');
  return ctx;
}

// Small selectors shared across features.
export function useDecision(decisionId: string | undefined): Decision | undefined {
  const { state } = useStore();
  return state.decisions.find((d) => d.id === decisionId);
}

export function newId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}
