// One client-side store for the prototype, persisted to localStorage.
// Every feature reads and writes through these actions; add new ones here
// rather than keeping parallel state in a feature.
import { createContext, useContext, useEffect, useMemo, useReducer, type ReactNode } from 'react';
import { seedState } from '../data/fixtures';
import type {
  AppState,
  ContextItem,
  Decision,
  Gap,
  OptionNode,
  Provider,
  Source,
  User,
  WrongAnswerReport,
} from '../types';
import { demoUser } from '../data/fixtures';
import { driveCorpus, slackCorpus } from '../data/slackCorpus';
import { descendantIds, splitForLog } from './tree';

export const STORAGE_KEY = 'rooted-demo-v1';

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
  | { type: 'deleteAllData' }
  | { type: 'resetDemo' };

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
    case 'deleteAllData':
      // F-23: wipes decisions, context and reports and disconnects every source.
      return {
        ...state,
        decisions: [],
        contextItems: [],
        gaps: [],
        options: [],
        reports: [],
        sources: state.sources.map((s) => ({ ...s, connected: false, connectedAt: undefined })),
      };
    case 'resetDemo':
      return { ...seedState(), user: state.user };
  }
}

function load(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as AppState;
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
