// F-01, F-21: real sign-in (decision 0015). Supabase Auth with an email magic
// link, Google or Slack. This is the only file that talks to Supabase Auth; the
// rest of the app sees an AuthClient, which tests replace with a fake.
import { createClient, type AuthError, type User as SupabaseUser } from '@supabase/supabase-js';
import type { Provider } from '../types';

export type OAuthProvider = 'google' | 'slack';

export interface AuthIdentity {
  authId: string; // the Supabase user id
  email: string;
  name: string;
  provider: Provider;
}

export type AuthErrorCode =
  | 'invalid_email'
  | 'rate_limited'
  | 'network'
  | 'provider_unavailable'
  | 'link_expired'
  | 'other_browser'
  | 'cancelled'
  | 'unknown';

export type AuthResult = { ok: true } | { ok: false; error: AuthErrorCode };

export interface AuthClient {
  getIdentity(): Promise<AuthIdentity | null>;
  /** The current session's access token, for calling Rooted's AI service (0016). */
  getAccessToken(): Promise<string | null>;
  onChange(listener: (identity: AuthIdentity | null) => void): () => void;
  sendMagicLink(email: string, redirectTo: string): Promise<AuthResult>;
  signInWith(provider: OAuthProvider, redirectTo: string): Promise<AuthResult>;
  signOut(): Promise<void>;
}

// What the person sees for each failure. Plain, with what to do next.
export const AUTH_ERROR_MESSAGE: Record<AuthErrorCode, string> = {
  invalid_email: 'That email address doesn’t look right. Check it and try again.',
  rate_limited: 'Too many sign-in emails were sent just now. Wait a few minutes, then try again.',
  network: 'Rooted couldn’t reach the sign-in service. Check your connection and try again.',
  provider_unavailable: 'That sign-in option isn’t available right now. Try another one, or email.',
  link_expired: 'That sign-in link has expired or was already used. Ask for a new one.',
  other_browser: 'Open the sign-in link in the same browser you asked for it from, or ask for a new link here.',
  cancelled: 'Sign-in was cancelled. You can try again whenever you’re ready.',
  unknown: 'Something went wrong signing you in. Try again, and if it keeps happening, report a problem from Help.',
};

const SUPABASE_PROVIDER: Record<OAuthProvider, 'google' | 'slack_oidc'> = { google: 'google', slack: 'slack_oidc' };

export function identityOf(user: SupabaseUser): AuthIdentity {
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const email = user.email ?? '';
  const named = [meta.full_name, meta.name].find((v): v is string => typeof v === 'string' && v.trim() !== '');
  const raw = user.app_metadata?.provider;
  const provider: Provider = raw === 'google' ? 'google' : raw === 'slack_oidc' || raw === 'slack' ? 'slack' : 'email';
  return { authId: user.id, email, name: named?.trim() ?? (email.split('@')[0] || 'You'), provider };
}

export function errorCodeOf(error: Pick<AuthError, 'message'> & { status?: number; code?: string }): AuthErrorCode {
  const code = error.code ?? '';
  const message = (error.message ?? '').toLowerCase();
  if (error.status === 429 || code.includes('rate_limit') || message.includes('rate limit')) return 'rate_limited';
  // Checked before validation_failed: Supabase reports a disabled provider that way too.
  if (code === 'provider_disabled' || message.includes('provider is not enabled') || message.includes('unsupported provider'))
    return 'provider_unavailable';
  if (code === 'email_address_invalid' || code === 'validation_failed' || message.includes('invalid email'))
    return 'invalid_email';
  if (code === 'otp_expired' || message.includes('expired')) return 'link_expired';
  if (code === 'bad_code_verifier' || message.includes('code verifier')) return 'other_browser';
  if (error.status === 0 || message.includes('failed to fetch') || message.includes('network')) return 'network';
  return 'unknown';
}

/**
 * What a provider or Supabase put in the URL when it sent the person back
 * with an error (a cancelled consent screen, an expired link).
 */
export function callbackError(search: string, hash: string): AuthErrorCode | null {
  const params = new URLSearchParams(search);
  const fromHash = new URLSearchParams(hash.replace(/^#/, ''));
  const error = params.get('error') ?? fromHash.get('error');
  if (!error) return null;
  const code = params.get('error_code') ?? fromHash.get('error_code') ?? '';
  const description = (params.get('error_description') ?? fromHash.get('error_description') ?? '').toLowerCase();
  if (error === 'access_denied' && (code === 'otp_expired' || description.includes('expired'))) return 'link_expired';
  if (error === 'access_denied') return 'cancelled';
  return errorCodeOf({ message: description, code });
}

function toResult(error: AuthError | null): AuthResult {
  return error ? { ok: false, error: errorCodeOf(error) } : { ok: true };
}

async function guarded(run: () => Promise<AuthResult>): Promise<AuthResult> {
  try {
    return await run();
  } catch {
    return { ok: false, error: 'network' };
  }
}

/** The real client, or null when the app has no Supabase URL and key (see .env.example). */
export function createAuthClient(): AuthClient | null {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!url || !key) return null;
  const supabase = createClient(url, key, { auth: { flowType: 'pkce', persistSession: true, detectSessionInUrl: true } });
  return {
    async getIdentity() {
      const { data } = await supabase.auth.getSession();
      return data.session ? identityOf(data.session.user) : null;
    },
    async getAccessToken() {
      // getSession refreshes an expired token before handing it back.
      const { data } = await supabase.auth.getSession();
      return data.session?.access_token ?? null;
    },
    onChange(listener) {
      const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        listener(session ? identityOf(session.user) : null);
      });
      return () => data.subscription.unsubscribe();
    },
    sendMagicLink(email, redirectTo) {
      return guarded(async () =>
        toResult((await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } })).error),
      );
    },
    signInWith(provider, redirectTo) {
      return guarded(async () =>
        toResult(
          (await supabase.auth.signInWithOAuth({ provider: SUPABASE_PROVIDER[provider], options: { redirectTo } })).error,
        ),
      );
    },
    async signOut() {
      try {
        await supabase.auth.signOut();
      } catch {
        // Signed out locally either way; the session token is dropped.
      }
    },
  };
}
