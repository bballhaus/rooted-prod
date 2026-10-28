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

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'signIn':
      return { ...state, user: { ...(state.user ?? demoUser), signInProvider: action.provider } };
    case 'signOut':
      return { ...state, user: null };
    case 'updateUser':
      return state.user ? { ...state, user: { ...state.user, ...action.patch } } : state;
    case 'updateSource':
      return {
        ...state,
        sources: state.sources.map((s) => (s.id === action.sourceId ? { ...s, ...action.patch } : s)),
      };
    case 'setChannelAllowed':
      return {
        ...state,
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
    case 'updateOption':
      return {
        ...state,
        options: state.options.map((o) => (o.id === action.optionId ? { ...o, ...action.patch } : o)),
      };
    case 'logDecision': {
      const reasons = new Map(action.pruned.map((p) => [p.optionId, p.reason]));
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
          return { ...o, state: 'pruned', pruneReason: reasons.get(o.id) ?? o.pruneReason ?? '' };
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
