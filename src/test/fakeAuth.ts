// A stand-in for Supabase Auth in tests, so no test ever signs in for real.
import { vi } from 'vitest';
import type { AuthClient, AuthIdentity } from '../auth/client';
import type { User } from '../types';

export type FakeAuth = AuthClient & { emit: (identity: AuthIdentity | null) => void };

export function identityFor(user: User | null | undefined): AuthIdentity | null {
  if (!user) return null;
  return { authId: user.authId ?? `auth-${user.id}`, email: user.email, name: user.name, provider: user.signInProvider };
}

export function fakeAuth(identity: AuthIdentity | null = null, overrides: Partial<AuthClient> = {}): FakeAuth {
  const listeners = new Set<(identity: AuthIdentity | null) => void>();
  let current = identity;
  const emit = (next: AuthIdentity | null) => {
    current = next;
    listeners.forEach((l) => l(next));
  };
  return {
    getIdentity: vi.fn(async () => current),
    onChange: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    sendMagicLink: vi.fn(async () => ({ ok: true as const })),
    signInWith: vi.fn(async () => ({ ok: true as const })),
    signOut: vi.fn(async () => emit(null)),
    emit,
    ...overrides,
  };
}
