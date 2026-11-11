// Keeps the store's signed-in user in step with the real Supabase session
// (decision 0015). A session in the URL (coming back from a magic link, Google
// or Slack) or in storage signs the person in; no session signs them out.
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useStore } from '../store/store';
import { createAuthClient, type AuthClient } from './client';

interface AuthValue {
  client: AuthClient | null; // null: the app has no Supabase settings, so nobody can sign in
  checked: boolean; // the stored session has been read at least once
}

const AuthContext = createContext<AuthValue>({ client: null, checked: true });

let defaultClient: AuthClient | null | undefined;
function appClient(): AuthClient | null {
  if (defaultClient === undefined) defaultClient = createAuthClient();
  return defaultClient;
}

export function AuthProvider({ children, client }: { children: ReactNode; client?: AuthClient | null }) {
  const { dispatch } = useStore();
  const auth = client === undefined ? appClient() : client;
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!auth) {
      // Without sign-in settings, no one is signed in, including a user left
      // over in storage from the old mocked sign-in.
      dispatch({ type: 'signOut' });
      setChecked(true);
      return;
    }
    let live = true;
    // A change event is newer than the first read of the stored session, so
    // once one arrives, a slower first read must not undo it.
    let changed = false;
    const apply = (identity: Awaited<ReturnType<AuthClient['getIdentity']>>) => {
      if (!live) return;
      dispatch(identity ? { type: 'signIn', identity } : { type: 'signOut' });
      setChecked(true);
    };
    auth.getIdentity().then(
      (identity) => !changed && apply(identity),
      () => !changed && apply(null),
    );
    const stop = auth.onChange((identity) => {
      changed = true;
      apply(identity);
    });
    return () => {
      live = false;
      stop();
    };
  }, [auth, dispatch]);

  const value = useMemo(() => ({ client: auth, checked }), [auth, checked]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  return useContext(AuthContext);
}
