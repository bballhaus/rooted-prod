// F-01, F-21: real sign-in (decision 0015) with Google, Slack or an emailed
// link, through Supabase Auth. Signing in only proves who you are: it doesn't
// connect Slack or Drive data, which you choose on the next page.
// F-20: request beta access with a work email (mocked; nothing is stored or sent).
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { AUTH_ERROR_MESSAGE, callbackError, type AuthErrorCode, type OAuthProvider } from '../../auth/client';
import { useStore } from '../../store/store';
import { GlyphG, GlyphHash, SproutMark } from './icons';
import './auth.css';

// Set before leaving for a provider or an email link, so the first arrival
// back goes on to choosing sources rather than straight home.
const ARRIVING_KEY = 'rooted-signing-in';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function markArriving() {
  try {
    localStorage.setItem(ARRIVING_KEY, '1');
  } catch {
    // without storage the PM just lands on home
  }
}

// Read during render, cleared in an effect: render can run twice.
function isArriving(): boolean {
  try {
    return localStorage.getItem(ARRIVING_KEY) === '1';
  } catch {
    return false;
  }
}

function clearArriving() {
  try {
    localStorage.removeItem(ARRIVING_KEY);
  } catch {
    // nothing to clear
  }
}

const redirectTo = () => `${window.location.origin}/signin`;

export function SignInPage() {
  const { state } = useStore();
  const location = useLocation();
  const [tab, setTab] = useState<'signin' | 'request'>('signin');
  const signedIn = !!state.user;

  useEffect(() => {
    if (signedIn) clearArriving();
  }, [signedIn]);

  if (signedIn) {
    const from = (location.state as { from?: string } | null)?.from;
    return <Navigate to={isArriving() ? '/onboarding' : (from ?? '/')} replace />;
  }

  return (
    <div className="auth-split">
      <aside className="auth-brand" aria-label="About Rooted">
        <span className="auth-wordmark">
          <SproutMark />
          Rooted
        </span>
        <div className="auth-brand-body">
          <p className="auth-brand-kicker">Decision partner for startup PMs</p>
          <h1 className="auth-brand-title">Every call leaves a record.</h1>
          <p className="auth-brand-lead">
            Rooted gathers context from where your team already works, helps you weigh the options and keeps a history
            of what you decided and why. You make the call.
          </p>
          <BrandTree />
        </div>
        <ul className="auth-points">
          <li>
            <span className="auth-point-dot auth-point-sage" aria-hidden="true" />
            Reads only the Slack channels you choose
          </li>
          <li>
            <span className="auth-point-dot auth-point-ochre" aria-hidden="true" />
            Lays out the options as a tree; you prune and choose
          </li>
          <li>
            <span className="auth-point-dot auth-point-cream" aria-hidden="true" />
            Remembers why, and asks later what happened
          </li>
        </ul>
      </aside>

      <main id="main" className="auth-panel">
        <div className="auth-panel-inner">
          <span className="pill auth-proto">Beta · sample data</span>
          <div className="auth-tabs" role="tablist" aria-label="Sign in or request access">
            <button
              type="button"
              role="tab"
              id="auth-tab-signin"
              aria-selected={tab === 'signin'}
              aria-controls="auth-panel-signin"
              onClick={() => setTab('signin')}
            >
              Sign in
            </button>
            <button
              type="button"
              role="tab"
              id="auth-tab-request"
              aria-selected={tab === 'request'}
              aria-controls="auth-panel-request"
              onClick={() => setTab('request')}
            >
              Request access
            </button>
          </div>

          {tab === 'signin' ? <SignIn onRequest={() => setTab('request')} /> : <RequestAccess onSignIn={() => setTab('signin')} />}

          <p className="muted auth-small auth-fineprint">
            Your decisions stay in this browser. <Link to="/privacy">How Rooted handles your data</Link>
          </p>
        </div>
      </main>
    </div>
  );
}

function SignIn({ onRequest }: { onRequest: () => void }) {
  const { client, checked } = useAuth();
  const location = useLocation();
  const id = useId();
  const sentRef = useRef<HTMLParagraphElement>(null);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState<OAuthProvider | 'email' | null>(null);
  const [sentTo, setSentTo] = useState('');
  const [error, setError] = useState<AuthErrorCode | null>(() => callbackError(location.search, location.hash));

  // A provider can send the person back here with an error after a redirect.
  useEffect(() => {
    const fromUrl = callbackError(location.search, location.hash);
    if (fromUrl) setError(fromUrl);
  }, [location.search, location.hash]);

  // A link carries a one-time code that only the browser that asked for it
  // can use. If the code is still here once the session is checked and nobody
  // is signed in, the link was opened somewhere else.
  useEffect(() => {
    if (checked && new URLSearchParams(location.search).has('code')) setError('other_browser');
  }, [checked, location.search]);

  // Coming back with the browser's Back button can restore this page as it
  // was left, mid-redirect; make the buttons usable again.
  useEffect(() => {
    const reset = (e: PageTransitionEvent) => e.persisted && setBusy(null);
    window.addEventListener('pageshow', reset);
    return () => window.removeEventListener('pageshow', reset);
  }, []);

  // Move focus to the confirmation when the form it replaces goes away.
  useEffect(() => {
    if (sentTo) sentRef.current?.focus();
  }, [sentTo]);

  useEffect(() => {
    if (!client) console.warn('Rooted: sign-in needs VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (see .env.example).');
  }, [client]);

  async function withProvider(provider: OAuthProvider) {
    if (!client) return;
    setError(null);
    setBusy(provider);
    markArriving();
    const result = await client.signInWith(provider, redirectTo());
    // On success the browser is already leaving for the provider.
    if (!result.ok) {
      setError(result.error);
      setBusy(null);
    }
  }

  async function sendLink(e: FormEvent) {
    e.preventDefault();
    if (!client) return;
    const address = email.trim();
    if (!EMAIL_RE.test(address)) {
      setError('invalid_email');
      return;
    }
    setError(null);
    setBusy('email');
    markArriving();
    const result = await client.sendMagicLink(address, redirectTo());
    setBusy(null);
    if (result.ok) setSentTo(address);
    else setError(result.error);
  }

  return (
    <section id="auth-panel-signin" role="tabpanel" aria-labelledby="signin-title" className="stack">
      <div className="stack auth-tight">
        <h2 id="signin-title" className="auth-title">
          Sign in
        </h2>
        <p className="muted">Use the account your team already works in.</p>
      </div>

      {!client && (
        <p role="status" className="banner">
          Sign-in isn’t available right now. Try again later.
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="error">
          {AUTH_ERROR_MESSAGE[error]}
        </p>
      )}

      {sentTo ? (
        <div className="banner stack auth-tight" role="status">
          {/* Focus lands here, so keyboard and screen reader users hear it. */}
          <p ref={sentRef} tabIndex={-1}>
            <strong>Check your inbox.</strong> We sent a sign-in link to {sentTo}. Open it in this browser to sign in.
          </p>
          <p className="muted auth-small">Nothing there after a minute? Check spam, or send it again.</p>
          <div className="row">
            <button type="button" className="btn btn-secondary" disabled={busy !== null} onClick={sendLink}>
              {busy === 'email' ? 'Sending…' : 'Send it again'}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setSentTo('');
                setError(null);
              }}
            >
              Use a different email
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="auth-providers">
            <button
              type="button"
              className="btn btn-secondary btn-lg"
              disabled={!client || busy !== null}
              aria-busy={busy === 'google'}
              onClick={() => withProvider('google')}
            >
              <GlyphG />
              {busy === 'google' ? 'Opening Google…' : 'Continue with Google'}
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-lg"
              disabled={!client || busy !== null}
              aria-busy={busy === 'slack'}
              onClick={() => withProvider('slack')}
            >
              <GlyphHash />
              {busy === 'slack' ? 'Opening Slack…' : 'Continue with Slack'}
            </button>
          </div>
          <p className="muted auth-small">
            Signing in with Slack only shares your name and email. It doesn’t give Rooted your messages.
          </p>
          <p className="auth-or" aria-hidden="true">
            or
          </p>
          <form className="stack" onSubmit={sendLink} noValidate>
            <div className="field">
              <label htmlFor={id}>Work email</label>
              <input
                id={id}
                type="email"
                className="input"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={error === 'invalid_email' ? 'true' : undefined}
                aria-describedby={error === 'invalid_email' ? `${id}-error` : undefined}
              />
            </div>
            <button type="submit" className="btn btn-lg" disabled={!client || busy !== null} aria-busy={busy === 'email'}>
              {busy === 'email' ? 'Sending…' : 'Email me a sign-in link'}
            </button>
          </form>
        </>
      )}

      <p className="muted auth-small">
        New to Rooted?{' '}
        <button type="button" className="auth-link" onClick={onRequest}>
          Request beta access
        </button>
      </p>
    </section>
  );
}

// A small decision tree in brand colors: one chosen branch (cream), pruned
// branches (dashed rose) and living ones (sage). Decorative.
function BrandTree() {
  return (
    <svg className="auth-tree" viewBox="0 0 360 200" aria-hidden="true" focusable="false">
      <g fill="none" strokeLinecap="round" strokeWidth="2.2">
        <path d="M20 170 C 80 170, 90 110, 150 110" stroke="var(--brand-line)" />
        <path d="M150 110 C 200 110, 210 50, 270 50" stroke="var(--brand-chosen)" strokeWidth="3" />
        <path d="M150 110 C 205 110, 215 110, 270 110" stroke="var(--brand-pruned)" strokeDasharray="5 6" />
        <path d="M150 110 C 200 110, 210 170, 270 170" stroke="var(--brand-alive)" />
        <path d="M270 50 C 300 50, 305 30, 335 30" stroke="var(--brand-chosen)" strokeWidth="3" />
        <path d="M270 50 C 300 50, 305 72, 335 72" stroke="var(--brand-pruned)" strokeDasharray="5 6" />
      </g>
      <circle cx="20" cy="170" r="7" fill="var(--brand-line)" />
      <circle cx="150" cy="110" r="8" fill="var(--brand-line)" />
      <circle cx="270" cy="50" r="9" fill="var(--brand-chosen)" />
      <circle cx="270" cy="50" r="14" fill="none" stroke="var(--brand-chosen)" strokeOpacity="0.4" strokeWidth="2" />
      <circle cx="270" cy="110" r="6" fill="none" stroke="var(--brand-pruned)" strokeWidth="2" />
      <circle cx="270" cy="170" r="7" fill="var(--brand-alive)" />
      <circle cx="335" cy="30" r="7" fill="var(--brand-chosen)" />
      <circle cx="335" cy="72" r="5" fill="none" stroke="var(--brand-pruned)" strokeWidth="2" />
    </svg>
  );
}

// F-20: beta request. A prototype stand-in: it checks the address and says
// thanks, and nothing is stored or sent anywhere.
function RequestAccess({ onSignIn }: { onSignIn: () => void }) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const id = useId();

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Enter your work email, like jordan@yourcompany.com.');
      return;
    }
    setError('');
    setDone(true);
  }

  return (
    <section id="auth-panel-request" role="tabpanel" aria-labelledby="request-title" className="stack">
      <div className="stack auth-tight">
        <h2 id="request-title" className="auth-title">
          Request beta access
        </h2>
        <p className="muted">Rooted is in a small beta with product teams at early-stage startups.</p>
      </div>
      {done ? (
        <div className="banner stack auth-tight" role="status">
          <p>
            <strong>Thanks, you’re on the list.</strong> In the real product we’d email you when a spot opens. This
            prototype didn’t store or send your address.
          </p>
          <p>
            <button type="button" className="auth-link" onClick={onSignIn}>
              Back to sign in
            </button>
          </p>
        </div>
      ) : (
        <form className="stack" onSubmit={submit} noValidate>
          <div className="field">
            <label htmlFor={id}>Work email</label>
            <input
              id={id}
              type="email"
              className="input"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={error ? 'true' : undefined}
              aria-describedby={error ? `${id}-error` : undefined}
            />
            {error && (
              <p id={`${id}-error`} role="alert" className="error">
                {error}
              </p>
            )}
          </div>
          <button type="submit" className="btn btn-lg">
            Request access
          </button>
        </form>
      )}
    </section>
  );
}
