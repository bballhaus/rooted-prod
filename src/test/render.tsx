// Test helper: renders a route tree with a fresh store and a memory router.
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { App } from '../App';
import { AuthProvider } from '../auth/AuthContext';
import type { AuthClient } from '../auth/client';
import { AgentProvider } from '../features/agent/AgentContext';
import { demoUser, seedState } from '../data/fixtures';
import { StoreProvider } from '../store/store';
import type { AppState } from '../types';
import { fakeAuth, identityFor } from './fakeAuth';

export function signedInState(patch: Partial<AppState> = {}): AppState {
  return { ...seedState(), user: structuredClone(demoUser), ...patch };
}

// Render the whole app at a path. Use this for page-level tests. Sign-in is a
// fake that holds a session for the state's user (or none), unless one is given.
export function renderApp(
  path: string,
  state: AppState = signedInState(),
  { auth = fakeAuth(identityFor(state.user)) }: { auth?: AuthClient | null } = {},
) {
  const user = userEvent.setup();
  const utils = render(
    <StoreProvider initialState={state}>
      <AuthProvider client={auth}>
        <MemoryRouter initialEntries={[path]}>
          <App />
        </MemoryRouter>
      </AuthProvider>
    </StoreProvider>,
  );
  return { user, ...utils };
}

// Render one component with the store, a router and the agent dock around it.
export function renderWithStore(ui: ReactElement, state: AppState = signedInState()) {
  const user = userEvent.setup();
  const utils = render(
    <StoreProvider initialState={state}>
      <MemoryRouter>
        <AgentProvider>{ui}</AgentProvider>
      </MemoryRouter>
    </StoreProvider>,
  );
  return { user, ...utils };
}
