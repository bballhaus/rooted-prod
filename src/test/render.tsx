// Test helper: renders a route tree with a fresh store and a memory router.
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { App } from '../App';
import { AiProvider } from '../agent/AiContext';
import type { AiClient } from '../agent/client';
import { AuthProvider } from '../auth/AuthContext';
import type { AuthClient } from '../auth/client';
import { AgentProvider } from '../features/agent/AgentContext';
import { demoUser, seedState } from '../data/fixtures';
import { StoreProvider } from '../store/store';
import type { AppState } from '../types';
import { fakeAi } from './fakeAi';
import { fakeAuth, identityFor } from './fakeAuth';

export function signedInState(patch: Partial<AppState> = {}): AppState {
  return { ...seedState(), user: structuredClone(demoUser), ...patch };
}

// Render the whole app at a path. Use this for page-level tests. Sign-in is a
// fake that holds a session for the state's user (or none), and the AI is a
// fake that never calls Claude, unless others are given.
export function renderApp(
  path: string,
  state: AppState = signedInState(),
  { auth = fakeAuth(identityFor(state.user)), ai = fakeAi() }: { auth?: AuthClient | null; ai?: AiClient | null } = {},
) {
  const user = userEvent.setup();
  const utils = render(
    <StoreProvider initialState={state}>
      <AuthProvider client={auth}>
        <AiProvider client={ai}>
          <MemoryRouter initialEntries={[path]}>
            <App />
          </MemoryRouter>
        </AiProvider>
      </AuthProvider>
    </StoreProvider>,
  );
  return { user, ...utils };
}

// Render one component with the store, a router and the agent dock around it.
export function renderWithStore(
  ui: ReactElement,
  state: AppState = signedInState(),
  { ai = fakeAi() }: { ai?: AiClient | null } = {},
) {
  const user = userEvent.setup();
  const utils = render(
    <StoreProvider initialState={state}>
      <AiProvider client={ai}>
        <MemoryRouter>
          <AgentProvider>{ui}</AgentProvider>
        </MemoryRouter>
      </AiProvider>
    </StoreProvider>,
  );
  return { user, ...utils };
}
