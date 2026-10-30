// Test helper: renders a route tree with a fresh store and a memory router.
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { App } from '../App';
import { demoUser, seedState } from '../data/fixtures';
import { StoreProvider } from '../store/store';
import type { AppState } from '../types';

export function signedInState(patch: Partial<AppState> = {}): AppState {
  return { ...seedState(), user: structuredClone(demoUser), ...patch };
}

// Render the whole app at a path. Use this for page-level tests.
export function renderApp(path: string, state: AppState = signedInState()) {
  const user = userEvent.setup();
  const utils = render(
    <StoreProvider initialState={state}>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </StoreProvider>,
  );
  return { user, ...utils };
}

// Render one component with the store and a router around it.
export function renderWithStore(ui: ReactElement, state: AppState = signedInState()) {
  const user = userEvent.setup();
  const utils = render(
    <StoreProvider initialState={state}>
      <MemoryRouter>{ui}</MemoryRouter>
    </StoreProvider>,
  );
  return { user, ...utils };
}
