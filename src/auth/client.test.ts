import { describe, expect, it } from 'vitest';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { callbackError, errorCodeOf, identityOf } from './client';

const supabaseUser = (patch: Partial<SupabaseUser>): SupabaseUser =>
  ({ id: 'auth-1', email: 'sam@startup.example', app_metadata: {}, user_metadata: {}, aud: 'authenticated', created_at: '', ...patch }) as SupabaseUser;

describe('identityOf', () => {
  it('F-01: takes the name the provider gave, else the email’s first part', () => {
    expect(identityOf(supabaseUser({ user_metadata: { full_name: ' Sam Rivera ' }, app_metadata: { provider: 'google' } }))).toEqual({
      authId: 'auth-1',
      email: 'sam@startup.example',
      name: 'Sam Rivera',
      provider: 'google',
    });
    expect(identityOf(supabaseUser({ app_metadata: { provider: 'email' } }))).toMatchObject({ name: 'sam', provider: 'email' });
  });

  it('F-21: Slack’s OpenID sign-in counts as Slack', () => {
    expect(identityOf(supabaseUser({ app_metadata: { provider: 'slack_oidc' }, user_metadata: { name: 'Sam' } })).provider).toBe('slack');
  });
});

describe('errorCodeOf', () => {
  it.each([
    [{ message: 'Email rate limit exceeded', status: 429 }, 'rate_limited'],
    [{ message: 'x', code: 'over_email_send_rate_limit' }, 'rate_limited'],
    [{ message: 'Unable to validate email address: invalid format', code: 'email_address_invalid' }, 'invalid_email'],
    [{ message: 'Unsupported provider: provider is not enabled', code: 'validation_failed' }, 'provider_unavailable'],
    [{ message: 'Unable to validate email address', code: 'validation_failed' }, 'invalid_email'],
    [{ message: 'Unsupported provider: provider is not enabled' }, 'provider_unavailable'],
    [{ message: 'Email link is invalid or has expired', code: 'otp_expired' }, 'link_expired'],
    [{ message: 'invalid request: both auth code and code verifier should be non-empty' }, 'other_browser'],
    [{ message: 'Failed to fetch', status: 0 }, 'network'],
    [{ message: 'Database error saving new user', status: 500 }, 'unknown'],
  ] as const)('maps %o to %s', (error, code) => {
    expect(errorCodeOf(error)).toBe(code);
  });
});

describe('callbackError', () => {
  it('is null when the URL carries no error', () => {
    expect(callbackError('?code=abc', '')).toBeNull();
  });
  it('reads errors from the query or the hash', () => {
    expect(callbackError('?error=access_denied&error_code=otp_expired', '')).toBe('link_expired');
    expect(callbackError('', '#error=access_denied&error_description=denied')).toBe('cancelled');
    expect(callbackError('?error=server_error&error_description=boom', '')).toBe('unknown');
  });
});
