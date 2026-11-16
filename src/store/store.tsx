// One client-side store for the prototype, persisted to localStorage.
// Every feature reads and writes through these actions; add new ones here
// rather than keeping parallel state in a feature.
import { createContext, useContext, useEffect, useMemo, useReducer, type ReactNode } from 'react';
import { demoState } from '../data/demoFixtures';
import { emptyWorkspaceState } from '../data/fixtures';
import type {
  AppState,
  ContextItem,
  ChatMessage,
  Decision,
  DecisionLink,
  Gap,
  Insight,
  OptionNode,
  Outcome,
  Source,
  SuggestedDecision,
  User,
  Workspace,
  WrongAnswerReport,
} from '../types';
import { ME } from '../data/history';
import type { AuthIdentity } from '../auth/client';
import { driveCorpus, slackCorpus } from '../data/slackCorpus';
import { descendantIds, splitForLog } from './tree';

// v2 added teammates, links, outcomes, suggestions and chat. v3 starts real
// workspaces empty (0018), so sample data saved before real sign-in isn't
// mistaken for a live Slack connection.
export const STORAGE_KEY = 'rooted-demo-v3';

export type Action =
  | { type: 'signIn'; identity: AuthIdentity }
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
  | { type: 'addSuggestions'; suggestions: SuggestedDecision[] }
  | { type: 'addLinks'; links: DecisionLink[] }
  | { type: 'addMessage'; message: ChatMessage }
  | { type: 'updateMessage'; messageId: string; patch: Partial<ChatMessage> }
  | { type: 'setInsights'; insights: Insight[]; forUser: string | null; demo: boolean }
  | { type: 'updateInsight'; insightId: string; patch: Partial<Insight> }
  | { type: 'deleteAllData' }
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
function revokedLabels(source: Source, channelId?: string): string[] {
  return source.channels
    .filter((c) => !channelId || c.id === channelId)
    .map((c) => (source.type === 'google-drive' ? `Drive: ${c.name}` : c.name));
}

function dropSuggestions(suggestions: SuggestedDecision[], labels: string[]): SuggestedDecision[] {
  return suggestions.filter((s) => !s.evidence.some((e) => labels.includes(e.sourceLabel)));
}

// F-02, F-23: when access is revoked, everything taken from that source or
// channel goes: gathered context, suggestions that quote it, and agent replies
// that quoted it (they'd otherwise go back to the LLM as chat history). The
// PM's own messages stay. Applies to the saved workspace during the demo too.
function revoke<W extends Pick<Workspace, 'contextItems' | 'suggestions' | 'messages'>>(
  w: W,
  source: Source,
  channelId?: string,
): W {
  const contextItems = dropContext(w.contextItems, source, channelId);
  const kept = new Set(contextItems.map((c) => c.id));
  const snippets = w.contextItems.filter((c) => !kept.has(c.id)).map((c) => c.snippet);
  const labels = revokedLabels(source, channelId);
  const quotes = (text: string) => snippets.some((sn) => text.includes(sn)) || labels.some((l) => text.includes(l));
  return {
    ...w,
    contextItems,
    suggestions: dropSuggestions(w.suggestions, labels),
    messages: w.messages.filter((m) => m.role !== 'agent' || !quotes(m.text)),
  };
}

function revokeAll(state: AppState, source: Source, channelId?: string): AppState {
  return {
    ...revoke(state, source, channelId),
    beforeDemo: state.beforeDemo && revoke(state.beforeDemo, source, channelId),
  };
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : (parts[0] ?? '?').slice(0, 2);
  return letters.toUpperCase();
}

// F-01: a real session signs the PM in. A different person on this browser
// starts from a fresh workspace, so nobody sees someone else's decisions,
// whether the last person signed out or not.
function signIn(state: AppState, identity: AuthIdentity): AppState {
  const prev = state.user ?? state.lastUser;
  // Someone from before real sign-in (no authId) is the same person if the email matches.
  const same = prev ? (prev.authId ? prev.authId === identity.authId : prev.email === identity.email) : false;
  if (
    state.user &&
    same &&
    prev?.authId === identity.authId &&
    prev.email === identity.email &&
    prev.signInProvider === identity.provider
  )
    return state;
  // Nobody has used this browser yet: the sample workspace is theirs.
  const base = prev && !same ? emptyWorkspaceState() : { ...state, lastUser: undefined };
  const kept = same ? prev : undefined;
  const name = kept?.name ?? identity.name;
  const user: User = {
    id: ME,
    authId: identity.authId,
    name,
    email: identity.email,
    role: kept?.role ?? '',
    team: kept?.team ?? '',
    company: kept?.company ?? '',
    plan: 'beta',
    signInProvider: identity.provider,
    notificationChannel: kept?.notificationChannel ?? 'email',
    defaultReviewDays: kept?.defaultReviewDays ?? 30,
  };
  return {
    ...base,
    user,
    // The PM is a teammate on the map too; show their real name there.
    teammates: base.teammates.map((t) => (t.id === ME ? { ...t, name, initials: initialsOf(name) } : t)),
  };
}

function workspaceOf({
  user: _user,
  demo: _demo,
  beforeDemo: _before,
  lastUser: _last,
  ...w
}: AppState): Workspace {
  return w;
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'signIn':
      return signIn(state, action.identity);
    case 'signOut':
      // The workspace stays in this browser for the same person to come back
      // to; signIn starts anyone else fresh.
      return state.user ? { ...state, user: null, lastUser: state.user } : state;
    case 'updateUser':
      return state.user ? { ...state, user: { ...state.user, ...action.patch } } : state;
    case 'updateSource': {
      const source = state.sources.find((s) => s.id === action.sourceId);
      const disconnecting = source?.connected && action.patch.connected === false;
      const next = disconnecting ? revokeAll(state, source) : state;
      return {
        ...next,
        sources: state.sources.map((s) => (s.id === action.sourceId ? { ...s, ...action.patch } : s)),
      };
    }
    case 'setChannelAllowed': {
      const source = state.sources.find((s) => s.id === action.sourceId);
      const next = source && !action.allowed ? revokeAll(state, source, action.channelId) : state;
      return {
        ...next,
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
    case 'addSuggestions': {
      // Don't raise the same question twice.
      const asked = new Set(state.suggestions.map((s) => s.question.toLowerCase()));
      return { ...state, suggestions: [...state.suggestions, ...action.suggestions.filter((s) => !asked.has(s.question.toLowerCase()))] };
    }
    case 'addLinks': {
      // One link per pair: a suggestion never replaces a link the PM made or dismissed.
      const pair = (l: DecisionLink) => [l.fromId, l.toId].sort().join('|');
      const taken = new Set(state.links.map(pair));
      return { ...state, links: [...state.links, ...action.links.filter((l) => !taken.has(pair(l)))] };
    }
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
    case 'setInsights': {
      // An answer that comes back after the workspace changed (deleted, another
      // person signed in, the demo swapped in or out) belongs to the old one: drop it.
      if ((state.user?.authId ?? null) !== action.forUser || state.demo !== action.demo) return state;
      const ids = new Set(state.decisions.map((d) => d.id));
      const fresh = action.insights.filter((i) => i.decisionIds.every((id) => ids.has(id)));
      // Looking again keeps what the PM edited (F-08); everything else is replaced.
      const kept = state.insights.filter((i) => i.userEdited && !i.dismissed);
      return { ...state, insights: [...kept, ...fresh] };
    }
    case 'updateInsight':
      return {
        ...state,
        insights: state.insights.map((i) => (i.id === action.insightId ? { ...i, ...action.patch } : i)),
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
        insights: [],
        // From inside the demo, it's the PM's own sources (set aside) that are disconnected.
        sources: (state.demo && state.beforeDemo ? state.beforeDemo.sources : state.sources).map((s) => ({
          ...s,
          connected: false,
          connectedAt: undefined,
        })),
        // Deleting everything includes the workspace saved aside during the demo.
        demo: false,
        beforeDemo: undefined,
      };
    case 'loadDemo':
      // Swap in the planted demo workspace (0009), setting the PM's own work
      // and sources aside. The demo reads only its own sample sources, never
      // the PM's live Slack (0017).
      if (state.demo) return state;
      return { ...demoState(), user: state.user, beforeDemo: workspaceOf(state) };
    case 'exitDemo':
      // Bring the PM's own workspace back as they left it.
      if (!state.demo) return state;
      return {
        ...emptyWorkspaceState(),
        ...(state.beforeDemo ?? {}),
        user: state.user,
        demo: false,
        beforeDemo: undefined,
      };
  }
}

function load(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    // Fill in anything an older save is missing, so new fields never crash the demo.
    if (raw) return { ...emptyWorkspaceState(), ...(JSON.parse(raw) as Partial<AppState>) };
  } catch {
    // fall through to the seed
  }
  return emptyWorkspaceState();
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
