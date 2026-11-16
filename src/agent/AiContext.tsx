// Gives every feature the AI client (decision 0016). It signs requests with
// the PM's real session; tests pass a fake client instead.
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useAuth } from '../auth/AuthContext';
import { createAiClient, type AiClient } from './client';

const AiContext = createContext<AiClient | null>(null);

export function AiProvider({ children, client }: { children: ReactNode; client?: AiClient | null }) {
  const { client: auth } = useAuth();
  const value = useMemo(
    () =>
      client !== undefined
        ? client
        : createAiClient(import.meta.env.VITE_AI_URL, () => auth?.getAccessToken() ?? Promise.resolve(null)),
    [client, auth],
  );
  return <AiContext.Provider value={value}>{children}</AiContext.Provider>;
}

/** The AI client, or null when this copy of Rooted has no AI service. */
export function useAi(): AiClient | null {
  return useContext(AiContext);
}
