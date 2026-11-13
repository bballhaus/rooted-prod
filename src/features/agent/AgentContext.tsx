// F-12, F-13 and AI search: the agent dock's state. The launcher in the corner,
// the header search and "Talk it through" on an option all go through here.
// Messages live in the store, one thread per scope.
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { AI_ERROR_MESSAGE, askAgent, errorCode, type ChatScope } from '../../agent';
import { useAi } from '../../agent/AiContext';
import { newId, useStore } from '../../store/store';

export function threadId(scope: ChatScope): string {
  if (scope.decisionId && scope.optionId) return `${scope.decisionId}:${scope.optionId}`;
  return scope.decisionId ?? 'general';
}

interface AgentDock {
  open: boolean;
  scope: ChatScope;
  pending: boolean;
  /** Decisions the last answer cited; the map highlights them. */
  highlight: string[];
  /** Bumps when the input should take focus; opening on arrival doesn't move focus. */
  focusRequest: number;
  openAgent: (scope?: ChatScope, options?: { focus?: boolean }) => void;
  close: () => void;
  ask: (question: string, scope?: ChatScope) => void;
}

const AgentContext = createContext<AgentDock | null>(null);

export function AgentProvider({ children }: { children: ReactNode }) {
  const { state, dispatch } = useStore();
  const ai = useAi();
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<ChatScope>({});
  const [pending, setPending] = useState(false);
  const [highlight, setHighlight] = useState<string[]>([]);
  const [focusRequest, setFocusRequest] = useState(0);
  // The latest state, so an answer is built from what the PM sees now.
  const stateRef = useRef(state);
  stateRef.current = state;

  const openAgent = useCallback((next?: ChatScope, options?: { focus?: boolean }) => {
    if (next) setScope(next);
    setOpen(true);
    if (options?.focus !== false) setFocusRequest((n) => n + 1);
  }, []);

  const ask = useCallback(
    (question: string, next?: ChatScope) => {
      const text = question.trim();
      if (!text) return;
      const s = next ?? scope;
      if (next) setScope(next);
      setOpen(true);
      const thread = threadId(s);
      const history = stateRef.current.messages.filter((m) => m.threadId === thread);
      dispatch({
        type: 'addMessage',
        message: { id: newId('m'), threadId: thread, role: 'user', text, createdAt: new Date().toISOString() },
      });
      setPending(true);
      const answering = ai ? askAgent(ai, text, s, stateRef.current, history) : Promise.reject(new Error('not_configured'));
      void answering
        .then((answer) => {
          dispatch({
            type: 'addMessage',
            message: {
              id: newId('m'),
              threadId: thread,
              role: 'agent',
              text: answer.text,
              citations: answer.citations,
              createdAt: new Date().toISOString(),
            },
          });
          setHighlight(answer.citations.map((c) => c.decisionId));
        })
        .catch((error) => {
          // Never leave the chat stuck on "Thinking…": say what went wrong and offer the question again.
          const code = ai ? errorCode(error) : 'not_configured';
          dispatch({
            type: 'addMessage',
            message: {
              id: newId('m'),
              threadId: thread,
              role: 'agent',
              text: AI_ERROR_MESSAGE[code],
              failed: true,
              retry: text,
              failedCode: code,
              createdAt: new Date().toISOString(),
            },
          });
        })
        .finally(() => setPending(false));
    },
    [scope, dispatch, ai],
  );

  const value = useMemo(
    () => ({ open, scope, pending, highlight, focusRequest, openAgent, close: () => setOpen(false), ask }),
    [open, scope, pending, highlight, focusRequest, openAgent, ask],
  );
  return <AgentContext.Provider value={value}>{children}</AgentContext.Provider>;
}

export function useAgent(): AgentDock {
  const ctx = useContext(AgentContext);
  if (!ctx) throw new Error('useAgent must be used inside <AgentProvider>');
  return ctx;
}
